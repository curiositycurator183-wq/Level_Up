import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { Task, Exam, Priority, TaskStatus, ExamPrepStatus } from '../types';
import { awardXP, checkAndUnlockAchievements } from '../domain/gamification';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  MapPin,
  ListFilter,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PlannerPage: React.FC = () => {
  const { user } = useAuth();
  const { enqueueMutation } = useSync();

  // Active view: 'agenda' | 'month' | 'exams'
  const [activeView, setActiveView] = useState<'agenda' | 'month' | 'exams'>('agenda');

  // Filter tabs for tasks: 'pending' | 'completed' | 'overdue' | 'all'
  const [taskFilter, setTaskFilter] = useState<'pending' | 'completed' | 'overdue' | 'all'>('pending');

  // Month navigation
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Task modal & form
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskChapterId, setTaskChapterId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('Medium');
  const [taskEstimateMins, setTaskEstimateMins] = useState<number>(30);

  // Exam modal & form
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examSubjectId, setExamSubjectId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [examLocation, setExamLocation] = useState('');
  const [examStatus, setExamStatus] = useState<ExamPrepStatus>('Planning');
  const [examNotes, setExamNotes] = useState('');

  // Queries
  const subjects = useLiveQuery(
    () => db.subjects.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const chapters = useLiveQuery(
    () => db.chapters.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const tasks = useLiveQuery(
    () => db.tasks.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const exams = useLiveQuery(
    () => db.exams.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const activeSubjects = subjects.filter(s => !s.deleted_at);
  const activeChapters = chapters.filter(c => !c.deleted_at);
  const activeTasks = tasks.filter(t => !t.deleted_at);
  const activeExams = exams.filter(e => !e.deleted_at);

  const subjectMap = new Map(activeSubjects.map(s => [s.id, s]));

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter tasks based on taskFilter
  const filteredTasks = activeTasks.filter(t => {
    const isCompleted = t.status === 'Completed';
    const isOverdue = t.due_at && t.due_at.slice(0, 10) < todayStr && !isCompleted;

    if (taskFilter === 'pending') return !isCompleted;
    if (taskFilter === 'completed') return isCompleted;
    if (taskFilter === 'overdue') return isOverdue;
    return true;
  }).sort((a, b) => {
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  // Task CRUD
  const openNewTaskModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskSubjectId(activeSubjects[0]?.id || '');
    setTaskChapterId('');
    setTaskDueDate(todayStr);
    setTaskDueTime('18:00');
    setTaskPriority('Medium');
    setTaskEstimateMins(30);
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskSubjectId(task.subject_id || '');
    setTaskChapterId(task.chapter_id || '');
    if (task.due_at) {
      setTaskDueDate(task.due_at.slice(0, 10));
      setTaskDueTime(task.due_at.slice(11, 16) || '');
    } else {
      setTaskDueDate('');
      setTaskDueTime('');
    }
    setTaskPriority(task.priority);
    setTaskEstimateMins(task.estimated_minutes || 30);
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taskTitle.trim()) return;

    const now = new Date().toISOString();
    const id = editingTask ? editingTask.id : crypto.randomUUID();
    const dueAt = taskDueDate ? (taskDueTime ? `${taskDueDate}T${taskDueTime}:00` : `${taskDueDate}T23:59:59`) : undefined;

    const taskData: Task = {
      id,
      user_id: user.id,
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      subject_id: taskSubjectId || undefined,
      chapter_id: taskChapterId || undefined,
      due_at: dueAt,
      priority: taskPriority,
      status: editingTask ? editingTask.status : 'To Do',
      estimated_minutes: taskEstimateMins,
      created_at: editingTask ? editingTask.created_at : now,
      updated_at: now,
      completed_at: editingTask ? editingTask.completed_at : null,
      version: editingTask ? (editingTask.version || 1) + 1 : 1
    };

    await db.tasks.put(taskData);
    await enqueueMutation('tasks', id, 'UPSERT', taskData);
    setShowTaskModal(false);
  };

  const handleToggleTask = async (task: Task) => {
    if (!user) return;
    const isCompleted = task.status === 'Completed';
    const newStatus: TaskStatus = isCompleted ? 'To Do' : 'Completed';
    const now = new Date().toISOString();

    const updated: Task = {
      ...task,
      status: newStatus,
      completed_at: isCompleted ? null : now,
      updated_at: now,
      version: (task.version || 1) + 1
    };

    await db.tasks.put(updated);
    await enqueueMutation('tasks', task.id, 'UPSERT', updated);

    if (!isCompleted) {
      const awarded = await awardXP(
        user.id,
        'task',
        task.id,
        10,
        `Task Completed: ${task.title}`,
        `task_${task.id}`,
        enqueueMutation
      );
      if (awarded) {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      }
    }

    await checkAndUnlockAchievements(user.id, enqueueMutation);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!user) return;
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    const now = new Date().toISOString();
    const tombstone: Task = {
      ...task,
      deleted_at: now,
      updated_at: now,
      version: (task.version || 1) + 1
    };

    await db.tasks.put(tombstone);
    await enqueueMutation('tasks', task.id, 'DELETE', tombstone);
  };

  // Exam CRUD
  const openNewExamModal = () => {
    setEditingExam(null);
    setExamSubjectId(activeSubjects[0]?.id || '');
    setExamDate(todayStr);
    setExamTime('09:00');
    setExamLocation('');
    setExamStatus('Planning');
    setExamNotes('');
    setShowExamModal(true);
  };

  const openEditExamModal = (exam: Exam) => {
    setEditingExam(exam);
    setExamSubjectId(exam.subject_id);
    setExamDate(exam.exam_at);
    setExamTime(exam.exam_time || '');
    setExamLocation(exam.location || '');
    setExamStatus(exam.preparation_status);
    setExamNotes(exam.notes || '');
    setShowExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !examSubjectId || !examDate) return;

    const now = new Date().toISOString();
    const id = editingExam ? editingExam.id : crypto.randomUUID();

    const examData: Exam = {
      id,
      user_id: user.id,
      subject_id: examSubjectId,
      exam_at: examDate,
      exam_time: examTime || undefined,
      location: examLocation.trim() || undefined,
      preparation_status: examStatus,
      notes: examNotes.trim() || undefined,
      created_at: editingExam ? editingExam.created_at : now,
      updated_at: now,
      version: editingExam ? (editingExam.version || 1) + 1 : 1
    };

    await db.exams.put(examData);
    await enqueueMutation('exams', id, 'UPSERT', examData);
    setShowExamModal(false);
  };

  const handleDeleteExam = async (exam: Exam) => {
    if (!user) return;
    if (!window.confirm('Delete this examination entry?')) return;

    const now = new Date().toISOString();
    const tombstone: Exam = {
      ...exam,
      deleted_at: now,
      updated_at: now,
      version: (exam.version || 1) + 1
    };

    await db.exams.put(tombstone);
    await enqueueMutation('exams', exam.id, 'DELETE', tombstone);
  };

  // Calendar calculations for Monthly View
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };
  const goToday = () => {
    setCurrentCalendarDate(new Date());
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-500" />
            <span>Planner & Schedule</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage daily study tasks, examinations countdown, and calendar deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'exams' ? (
            <button
              onClick={openNewExamModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Exam</span>
            </button>
          ) : (
            <button
              onClick={openNewTaskModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('agenda')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeView === 'agenda'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tasks Agenda
          </button>
          <button
            onClick={() => setActiveView('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeView === 'month'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Calendar Month
          </button>
          <button
            onClick={() => setActiveView('exams')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeView === 'exams'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Exams ({activeExams.length})
          </button>
        </div>

        {activeView === 'agenda' && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            {(['pending', 'overdue', 'completed', 'all'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTaskFilter(filter)}
                className={`px-2.5 py-1 text-[11px] font-semibold capitalize rounded-lg transition ${
                  taskFilter === filter
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW 1: AGENDA TASKS */}
      {activeView === 'agenda' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
                No tasks matching this filter
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Keep your study sessions intentional by scheduling revision tasks and chapter deadlines.
              </p>
              <button
                onClick={openNewTaskModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-md hover:bg-emerald-500 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'Completed';
                const isOverdue = task.due_at && task.due_at.slice(0, 10) < todayStr && !isCompleted;
                const subj = task.subject_id ? subjectMap.get(task.subject_id) : undefined;

                return (
                  <div
                    key={task.id}
                    className="py-3 flex items-center justify-between gap-3 group first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task)}
                        className="text-slate-400 hover:text-emerald-500 transition shrink-0"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-emerald-500" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {task.title}
                          </p>
                          {isOverdue && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded">
                              Overdue
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          {subj && (
                            <span
                              className="font-semibold px-2 py-0.2 rounded-full text-[10px]"
                              style={{ backgroundColor: `${subj.colour}20`, color: subj.colour }}
                            >
                              {subj.name}
                            </span>
                          )}
                          {task.due_at && (
                            <span>Due: {task.due_at.slice(0, 10)} {task.due_at.slice(11, 16)}</span>
                          )}
                          {task.estimated_minutes && (
                            <span>• ~{task.estimated_minutes}m</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => openEditTaskModal(task)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Edit task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task)}
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CALENDAR MONTH */}
      {activeView === 'month' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-[11px] font-bold text-slate-400 uppercase">
                {d}
              </div>
            ))}

            {/* Empty slots for starting offset */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] p-1 rounded-2xl bg-slate-50/40 dark:bg-slate-950/20" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateISO === todayStr;

              // Items on this day
              const dayTasks = activeTasks.filter(t => t.due_at?.slice(0, 10) === dateISO);
              const dayExams = activeExams.filter(e => e.exam_at === dateISO);

              return (
                <div
                  key={dayNum}
                  className={`min-h-[85px] p-1.5 rounded-2xl border text-left flex flex-col justify-between transition ${
                    isToday
                      ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center' : 'text-slate-700 dark:text-slate-300'}`}>
                      {dayNum}
                    </span>
                    {(dayTasks.length > 0 || dayExams.length > 0) && (
                      <span className="text-[9px] font-semibold text-slate-400">
                        {dayTasks.length + dayExams.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayExams.map(ex => {
                      const subj = subjectMap.get(ex.subject_id);
                      return (
                        <div
                          key={ex.id}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 truncate border border-rose-200 dark:border-rose-900"
                          title={`Exam: ${subj?.name}`}
                        >
                          ⚡ {subj?.name || 'Exam'}
                        </div>
                      );
                    })}

                    {dayTasks.slice(0, 2).map(t => (
                      <div
                        key={t.id}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium truncate ${
                          t.status === 'Completed'
                            ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        • {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[8px] text-slate-400 font-medium pl-1">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: EXAMINATIONS PLANNER */}
      {activeView === 'exams' && (
        <div className="space-y-4">
          {activeExams.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center shadow-sm">
              <CalendarIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
                No examinations scheduled
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Add upcoming exams to unlock countdown timers and focus preparation timelines.
              </p>
              <button
                onClick={openNewExamModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-md hover:bg-rose-500 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Examination</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeExams.map((exam) => {
                const subj = subjectMap.get(exam.subject_id);
                const examDate = new Date(exam.exam_at);
                const diffDays = Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const isPast = diffDays < 0;

                return (
                  <div
                    key={exam.id}
                    className={`p-5 rounded-3xl border transition shadow-sm relative overflow-hidden group ${
                      isPast
                        ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                        : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-950/60 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1"
                          style={{ backgroundColor: `${subj?.colour || '#e11d48'}20`, color: subj?.colour || '#e11d48' }}
                        >
                          {subj?.name || 'Subject'}
                        </span>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                          Final Exam
                        </h4>
                      </div>

                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                        isPast
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : diffDays === 0
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                      }`}>
                        {isPast ? 'Completed' : diffDays === 0 ? 'Today!' : diffDays === 1 ? 'Tomorrow!' : `${diffDays} days left`}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: {exam.exam_at} {exam.exam_time && `at ${exam.exam_time}`}</span>
                      </div>
                      {exam.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>Venue: {exam.location}</span>
                        </div>
                      )}
                    </div>

                    {exam.notes && (
                      <p className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                        {exam.notes}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Status: <span className="text-slate-700 dark:text-slate-300">{exam.preparation_status}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditExamModal(exam)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam)}
                          className="p-1.5 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Task Create / Edit */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingTask ? 'Edit Task' : 'Create Study Task'}
            </h3>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Complete exercises 4.1 to 4.5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={taskSubjectId}
                    onChange={(e) => {
                      setTaskSubjectId(e.target.value);
                      setTaskChapterId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="">General (No Subject)</option>
                    {activeSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Description
                </label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Task details or textbook references..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Exam Create / Edit */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingExam ? 'Edit Examination' : 'Schedule Examination'}
            </h3>

            <form onSubmit={handleSaveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <select
                  required
                  value={examSubjectId}
                  onChange={(e) => setExamSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 dark:text-white"
                >
                  <option value="">Select subject...</option>
                  {activeSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Hall / Link
                </label>
                <input
                  type="text"
                  value={examLocation}
                  onChange={(e) => setExamLocation(e.target.value)}
                  placeholder="e.g. Hall B or Online Portal"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preparation Status
                </label>
                <select
                  value={examStatus}
                  onChange={(e) => setExamStatus(e.target.value as ExamPrepStatus)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 dark:text-white"
                >
                  <option value="Planning">Planning</option>
                  <option value="Underway">Revision Underway</option>
                  <option value="Ready">Fully Ready</option>
                  <option value="Completed">Exam Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Syllabus Chapters Covered
                </label>
                <textarea
                  value={examNotes}
                  onChange={(e) => setExamNotes(e.target.value)}
                  placeholder="Exam format, chapters included, allowable formulas..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
