// ==================== КОНСТАНТЫ ====================

const STORAGE_KEY = "weeklyPlanner.v1";

// ==================== СОСТОЯНИЕ ====================

const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: []
};

// ==================== ДНИ НЕДЕЛИ ====================

const DAYS = [
    { id: 'monday', name: 'Понедельник', emoji: '🔵' },
    { id: 'tuesday', name: 'Вторник', emoji: '🟠' },
    { id: 'wednesday', name: 'Среда', emoji: '🟢' },
    { id: 'thursday', name: 'Четверг', emoji: '🟡' },
    { id: 'friday', name: 'Пятница', emoji: '🔴' },
    { id: 'saturday', name: 'Суббота', emoji: '🟣' },
    { id: 'sunday', name: 'Воскресенье', emoji: '⚪' }
];

// ==================== УПРАВЛЕНИЕ ХРАНИЛИЩЕМ ====================

/**
 * Сохраняет состояние в LocalStorage
 */
function saveState() {
    try {
        state.updatedAt = new Date().toISOString();
        const serialized = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serialized);
        console.log('✅ State saved to LocalStorage');
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            showToast('❌ Ошибка: Хранилище переполнено', 'error');
            console.error('QuotaExceededError: LocalStorage is full', error);
        } else {
            showToast('❌ Ошибка при сохранении данных', 'error');
            console.error('Error saving state:', error);
        }
    }
}

/**
 * Загружает состояние из LocalStorage
 */
function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        // Если данные не найдены, возвращаем пустое состояние
        if (!stored) {
            console.log('ℹ️ No data in LocalStorage, using default state');
            return;
        }

        // Парсим JSON
        let parsed;
        try {
            parsed = JSON.parse(stored);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            showToast('⚠️ Данные повреждены, загруженно новое состояние', 'error');
            return;
        }

        // Проверяем версию
        if (parsed.version !== 1) {
            console.warn('Version mismatch: expected 1, got', parsed.version);
            showToast('⚠️ Версия данных не совместима', 'error');
            return;
        }

        // Проверяем структуру (наличие массива tasks)
        if (!Array.isArray(parsed.tasks)) {
            console.warn('Invalid structure: tasks is not an array');
            showToast('⚠️ Структура данных повреждена', 'error');
            return;
        }

        // Если все проверки пройдены, обновляем состояние
        Object.assign(state, parsed);
        console.log('✅ State loaded from LocalStorage:', state);

    } catch (error) {
        console.error('Unexpected error in loadState:', error);
        showToast('❌ Ошибка при загрузке данных', 'error');
    }
}

/**
 * Обработчик события storage для синхронизации между вкладками
 */
function handleStorageChange(event) {
    if (event.key === STORAGE_KEY) {
        console.log('📢 Storage changed in another tab, reloading...');
        loadState();
        renderApp();
        showToast('🔄 Данные обновлены в другой вкладке', 'success');
    }
}

// Подписываемся на события storage
window.addEventListener('storage', handleStorageChange);

// ==================== DRAG-AND-DROP ====================

let draggedTaskId = null;
let draggedTaskSourceDay = null;

/**
 * Начало перетаскивания задачи
 */
function handleDragStart(e, taskId) {
    // Блокируем drag-and-drop если клик произошёл по специальным элементам
    if (e.target.closest('.task-checkbox') || 
        e.target.closest('.task-btn') || 
        e.target.closest('input')) {
        e.preventDefault();
        return;
    }

    draggedTaskId = taskId;
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        draggedTaskSourceDay = task.day;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    
    // Добавляем визуальный эффект
    e.currentTarget.style.opacity = '0.5';
}

/**
 * Завершение перетаскивания
 */
function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    draggedTaskId = null;
    draggedTaskSourceDay = null;
    
    // Удаляем все placeholder'ы
    document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
    document.querySelectorAll('[data-day].tasks-container').forEach(el => {
        el.classList.remove('drag-over');
    });
}

/**
 * Перетаскивание над контейнером
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

/**
 * Вход в зону drop
 */
function handleDragEnter(e) {
    if (e.target.classList.contains('tasks-container')) {
        e.target.classList.add('drag-over');
    }
}

/**
 * Выход из зоны drop
 */
function handleDragLeave(e) {
    if (e.target.classList.contains('tasks-container')) {
        e.target.classList.remove('drag-over');
    }
}

/**
 * Drop задачи
 */
function handleDrop(e, targetDayId) {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTaskId) return;

    const targetContainer = e.target.closest('[data-day].tasks-container');
    if (!targetContainer) return;

    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    const sourceDayId = draggedTaskSourceDay;
    const sourceIndex = state.tasks.indexOf(task);

    // Если бросили на тот же день и примерно в то же место - ничего не делаем
    if (sourceDayId === targetDayId) {
        // Получаем все задачи этого дня в DOM порядке
        const dayTasks = targetContainer.querySelectorAll('.task-card');
        let targetIndex = 0;
        
        for (let i = 0; i < dayTasks.length; i++) {
            if (dayTasks[i].dataset.taskId === draggedTaskId) {
                // Находим позицию после этой карточки (где произойдёт drop)
                const rect = dayTasks[i].getBoundingClientRect();
                const dropY = e.clientY;
                
                if (dropY > rect.top + rect.height / 2) {
                    targetIndex = i + 1;
                } else {
                    targetIndex = i;
                }
                break;
            }
        }

        // Если позиция не изменилась - выходим
        if (targetIndex === sourceIndex) {
            return;
        }
    }

    // Удаляем задачу из старой позиции
    state.tasks.splice(sourceIndex, 1);

    // Если переходим в другой день - обновляем день задачи
    if (sourceDayId !== targetDayId) {
        task.day = targetDayId;
    }

    // Получаем все задачи целевого дня
    const targetDayTasks = state.tasks.filter(t => t.day === targetDayId);
    
    // Определяем индекс для вставки
    let insertIndex = state.tasks.length;
    
    if (targetDayTasks.length > 0) {
        // Находим позицию для вставки в целевой день
        const lastTaskOfDay = targetDayTasks[targetDayTasks.length - 1];
        insertIndex = state.tasks.indexOf(lastTaskOfDay) + 1;
    }

    // Вставляем задачу в новую позицию
    state.tasks.splice(insertIndex, 0, task);

    // Нормализуем order для изменённых дней
    normalizeTaskOrderForDay(sourceDayId);
    normalizeTaskOrderForDay(targetDayId);

    // Обновляем временные метки
    task.updatedAt = new Date().toISOString();
    state.updatedAt = new Date().toISOString();

    saveState();
    renderApp();
    showToast('✅ Задача перемещена', 'success');
}

/**
 * Нормализует поле order для всех задач конкретного дня
 */
function normalizeTaskOrderForDay(dayId) {
    const dayTasks = getTasksByDay(dayId);
    dayTasks.forEach((task, index) => {
        task.order = index;
    });
}

// ==================== РЕНДЕРИНГ ====================

/**
 * Генерирует уникальный ID для задачи
 */
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback для старых браузеров
    return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Получает задачи для конкретного дня
 */
function getTasksByDay(dayId) {
    return state.tasks.filter(task => task.day === dayId);
}

/**
 * Создает карточку задачи в HTML
 */
function renderTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.dataset.taskId = task.id;
    card.draggable = true;

    // Обработчики drag-and-drop
    card.addEventListener('dragstart', (e) => handleDragStart(e, task.id));
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);

    // Чекбокс
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
    checkbox.addEventListener('dragstart', (e) => e.stopPropagation());

    // Контент задачи
    const content = document.createElement('div');
    content.className = 'task-content';

    const text = document.createElement('div');
    text.className = 'task-text';
    text.textContent = task.text; // ✅ Безопасно - только текст, не HTML

    content.appendChild(text);

    // Кнопки действия
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'task-btn';
    editBtn.title = 'Редактировать';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => startEditTask(task.id));
    editBtn.addEventListener('dragstart', (e) => e.stopPropagation());

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-btn delete';
    deleteBtn.title = 'Удалить';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));
    deleteBtn.addEventListener('dragstart', (e) => e.stopPropagation());

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(checkbox);
    card.appendChild(content);
    card.appendChild(actions);

    return card;
}

/**
 * Перерисовывает все колонки дней
 */
function renderColumns() {
    DAYS.forEach(day => {
        // Находим контейнер для задач по data-day атрибуту
        const tasksContainer = document.querySelector(`[data-day="${day.id}"].tasks-container`);
        const taskCount = document.querySelector(`[data-day="${day.id}"].task-count`);

        if (!tasksContainer) return;

        // Очищаем контейнер
        tasksContainer.innerHTML = '';

        // Добавляем обработчики drag-and-drop на контейнер
        tasksContainer.addEventListener('dragenter', handleDragEnter);
        tasksContainer.addEventListener('dragleave', handleDragLeave);
        tasksContainer.addEventListener('dragover', handleDragOver);
        tasksContainer.addEventListener('drop', (e) => handleDrop(e, day.id));

        // Получаем задачи для этого дня
        const dayTasks = getTasksByDay(day.id);

        // Выводим пустое состояние, если нет задач
        if (dayTasks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Нет задач';
            tasksContainer.appendChild(emptyState);
        } else {
            // Сортируем по order и выводим карточки
            dayTasks.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(task => {
                tasksContainer.appendChild(renderTaskCard(task));
            });
        }

        // Обновляем счетчик
        if (taskCount) {
            taskCount.textContent = dayTasks.filter(t => !t.completed).length;
        }
    });

    // Обновляем общий прогресс
    updateProgress();
}

/**
 * Рассчитывает процент выполнения задач
 */
function calculateProgress() {
    const totalTasks = state.tasks.length;
    if (totalTasks === 0) {
        return 0;
    }
    const completedTasks = state.tasks.filter(t => t.completed).length;
    return Math.round((completedTasks / totalTasks) * 100);
}

/**
 * Обновляет строку прогресса
 */
function updateProgress() {
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const progressPercent = calculateProgress();

    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');

    if (progressText) {
        progressText.textContent = `Выполнено ${completedTasks} из ${totalTasks} задач - ${progressPercent}%`;
    }
    if (progressBar) {
        progressBar.style.width = progressPercent + '%';
    }
}

/**
 * Основная функция рендеринга приложения
 */
function renderApp() {
    renderColumns();
    updateProgress();
    console.log('✅ App re-rendered');
}

// ==================== УВЕДОМЛЕНИЯ ====================

/**
 * Показывает toast уведомление
 */
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" aria-label="Закрыть">✕</button>
    `;

    toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());

    // Автоматически удаляем через 4 секунды
    setTimeout(() => toast.remove(), 4000);
}

// ==================== ОПЕРАЦИИ С ЗАДАЧАМИ ====================

/**
 * Валидирует текст задачи
 */
function validateTaskText(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
        return null;
    }
    return trimmed;
}

/**
 * Создает новую задачу
 */
function createTask(dayId, text) {
    const validatedText = validateTaskText(text);
    if (!validatedText) {
        showToast('❌ Текст задачи должен быть от 1 до 200 символов', 'error');
        return null;
    }

    const dayTasks = getTasksByDay(dayId);
    const nextOrder = dayTasks.length;

    const task = {
        id: generateId(),
        day: dayId,
        text: validatedText,
        completed: false,
        order: nextOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    state.tasks.push(task);
    saveState();
    renderApp();
    showToast('✅ Задача добавлена', 'success');

    return task;
}

/**
 * Переключает статус выполнения задачи
 */
function toggleTaskComplete(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.updatedAt = new Date().toISOString();

    saveState();
    renderApp();
    showToast(task.completed ? '✅ Задача выполнена' : '⚪ Задача вернулась в список', 'success');
}

/**
 * Начинает редактирование задачи
 */
function startEditTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const card = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!card) return;

    // Сохраняем исходный текст
    const originalText = task.text;

    // Очищаем карточку
    card.innerHTML = '';

    // Создаем инпут для редактирования
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'task-edit-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.text;
    input.maxLength = 200;

    // Кнопки действия
    const actions = document.createElement('div');
    actions.className = 'task-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-small btn-primary';
    saveBtn.textContent = 'Сохранить';
    saveBtn.addEventListener('click', () => saveEditTask(taskId, input.value));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-small btn-secondary';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', () => cancelEditTask(taskId));

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(actions);

    card.appendChild(inputWrapper);
    input.focus();
    input.select();

    // Обработчики клавиш
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEditTask(taskId, input.value);
        } else if (e.key === 'Escape') {
            cancelEditTask(taskId);
        }
    });
}

/**
 * Сохраняет изменения задачи
 */
function saveEditTask(taskId, newText) {
    const validatedText = validateTaskText(newText);
    if (!validatedText) {
        showToast('❌ Текст должен быть от 1 до 200 символов', 'error');
        renderApp(); // Перерендериваем для отката
        return;
    }

    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        task.text = validatedText;
        task.updatedAt = new Date().toISOString();
        saveState();
        renderApp();
        showToast('✅ Задача обновлена', 'success');
    }
}

/**
 * Отменяет редактирование
 */
function cancelEditTask(taskId) {
    renderApp();
}

/**
 * Удаляет задачу
 */
function deleteTask(taskId) {
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = state.tasks[taskIndex];
    const dayId = task.day;

    // Удаляем задачу
    state.tasks.splice(taskIndex, 1);

    // Нормализуем поле order для оставшихся задач этого дня
    normalizeTaskOrder(dayId);

    saveState();
    renderApp();
    showToast('🗑️ Задача удалена', 'success');
}

/**
 * Нормализует поле order для задач конкретного дня
 */
function normalizeTaskOrder(dayId) {
    const dayTasks = getTasksByDay(dayId);
    dayTasks.forEach((task, index) => {
        task.order = index;
    });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

/**
 * Инициализация приложения при загрузке DOM
 */
function init() {
    console.log('Initializing app...');

    // Загружаем состояние из LocalStorage
    loadState();

    // Находим основные элементы
    const weekContainer = document.getElementById('weekContainer');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const resetModal = document.getElementById('resetModal');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const confirmResetBtn = document.getElementById('confirmResetBtn');

    if (!weekContainer) {
        console.error('Week container not found');
        return;
    }

    DAYS.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.dataset.dayId = day.id;

        dayColumn.innerHTML = `
            <div class="day-header">
                <div>
                    <span class="day-emoji">${day.emoji}</span>
                    <h2 class="day-title">${day.name}</h2>
                </div>
                <span class="task-count" data-day="${day.id}">0</span>
            </div>
            <div class="tasks-container" data-day="${day.id}"></div>
            <button class="add-task-btn" data-day="${day.id}">+ Добавить задачу</button>
        `;

        weekContainer.appendChild(dayColumn);
    });

    // Обработчики кнопок сброса
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            if (resetModal) resetModal.classList.add('active');
        });
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', () => {
            if (resetModal) resetModal.classList.remove('active');
        });
    }

    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', () => {
            state.tasks = [];
            saveState();
            renderApp();
            showToast('🗑️ Все задачи удалены', 'success');
            if (resetModal) resetModal.classList.remove('active');
        });
    }

    // Закрытие модала при клике на фон
    if (resetModal) {
        resetModal.addEventListener('click', (e) => {
            if (e.target === resetModal) {
                resetModal.classList.remove('active');
            }
        });

        // Закрытие модала по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && resetModal.classList.contains('active')) {
                resetModal.classList.remove('active');
            }
        });
    }

    // Обработчики кнопок добавления задач
    const addTaskBtns = document.querySelectorAll('.add-task-btn');
    addTaskBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dayId = btn.dataset.day;
            const tasksContainer = document.querySelector(`[data-day="${dayId}"]`);
            if (!tasksContainer) return;

            // Очищаем контейнер и показываем форму
            tasksContainer.innerHTML = '';

            const form = document.createElement('div');
            form.className = 'add-task-form';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'add-task-input';
            input.placeholder = 'Введи текст задачи...';
            input.maxLength = 200;

            const actions = document.createElement('div');
            actions.className = 'add-task-actions';

            const addBtn = document.createElement('button');
            addBtn.className = 'btn btn-small btn-primary';
            addBtn.textContent = 'Добавить';
            addBtn.addEventListener('click', () => {
                createTask(dayId, input.value);
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-small btn-secondary';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', () => {
                renderApp();
            });

            actions.appendChild(addBtn);
            actions.appendChild(cancelBtn);

            form.appendChild(input);
            form.appendChild(actions);

            tasksContainer.appendChild(form);
            input.focus();

            // Обработчики клавиш
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    createTask(dayId, input.value);
                } else if (e.key === 'Escape') {
                    renderApp();
                }
            });
        });
    });

    console.log('✅ App initialized');

    // Выполняем первый рендер
    renderApp();

    // Сохраняем состояние при загрузке
    saveState();
}

// Запускаем инициализацию когда DOM готов
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
