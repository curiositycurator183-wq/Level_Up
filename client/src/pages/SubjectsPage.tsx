import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { Subject, Chapter, Topic, Priority, ChapterStatus } from '../types';
import { awardXP, checkAndUnlockAchievements } from '../domain/gamification';
import { 
  BookOpen, 
  Plus, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  Layers, 
  AlertCircle,
  FileText,
  Calendar,
  Check,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PRESET_COLOURS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16'  // lime
];

export const SubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const { enqueueMutation } = useSync();

  // Selected subject for detail view
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Modals
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form states for subject
  const [subjectName, setSubjectName] = useState('');
  const [subjectColour, setSubjectColour] = useState(PRESET_COLOURS[0]);
  const [subjectPriority, setSubjectPriority] = useState<Priority>('Medium');
  const [subjectDesc, setSubjectDesc] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Chapter modal/form
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterPriority, setChapterPriority] = useState<Priority>('Medium');
  const [chapterDeadline, setChapterDeadline] = useState('');
  const [chapterNotes, setChapterNotes] = useState('');
  const [chapterStatus, setChapterStatus] = useState<ChapterStatus>('Not Started');

  // Topic form (inline or modal)
  const [addingTopicChapterId, setAddingTopicChapterId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState('');

  // Expanded chapter IDs in accordion
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());

  // Database queries
  const subjects = useLiveQuery(
    () => db.subjects.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const chapters = useLiveQuery(
    () => db.chapters.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const topics = useLiveQuery(
    () => db.topics.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const sessions = useLiveQuery(
    () => db.sessions.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const activeSubjects = subjects.filter(s => !s.deleted_at);
  const activeChapters = chapters.filter(c => !c.deleted_at);
  const activeTopics = topics.filter(t => !t.deleted_at);
  const activeSessions = sessions.filter(s => !s.deleted_at && s.status !== 'Abandoned');

  // Helper: calculate syllabus completion percentage for a subject
  const getSubjectStats = (subjectId: string) => {
    const subjChapters = activeChapters.filter(c => c.subject_id === subjectId);
    if (subjChapters.length === 0) {
      return { totalItems: 0, completedItems: 0, percent: 0, focusSeconds: 0 };
    }

    let totalItems = 0;
    let completedItems = 0;

    for (const ch of subjChapters) {
      const chTopics = activeTopics.filter(t => t.chapter_id === ch.id);
      if (chTopics.length > 0) {
        totalItems += chTopics.length;
        completedItems += chTopics.filter(t => t.status === 'Completed').length;
      } else {
        totalItems += 1;
        if (ch.status === 'Completed') completedItems += 1;
      }
    }

    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    // Subject focus seconds
    const focusSeconds = activeSessions
      .filter(s => s.subject_id === subjectId)
      .reduce((sum, s) => sum + s.actual_seconds, 0);

    return { totalItems, completedItems, percent, focusSeconds };
  };

  // Open Subject Modal
  const openNewSubjectModal = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectColour(PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)]);
    setSubjectPriority('Medium');
    setSubjectDesc('');
    setDuplicateWarning(null);
    setShowSubjectModal(true);
  };

  const openEditSubjectModal = (subj: Subject) => {
    setEditingSubject(subj);
    setSubjectName(subj.name);
    setSubjectColour(subj.colour);
    setSubjectPriority(subj.priority);
    setSubjectDesc(subj.description || '');
    setDuplicateWarning(null);
    setShowSubjectModal(true);
  };

  // Save Subject
  const handleSaveSubject = async (e: React.FormEvent, forceAllowDuplicate = false) => {
    e.preventDefault();
    if (!user || !subjectName.trim()) return;

    const trimmed = subjectName.trim();
    // Duplicate check
    const isDuplicate = activeSubjects.some(
      s => s.name.trim().toLowerCase() === trimmed.toLowerCase() && s.id !== editingSubject?.id
    );

    if (isDuplicate && !forceAllowDuplicate) {
      setDuplicateWarning(`A subject named "${trimmed}" already exists. Save anyway?`);
      return;
    }

    const now = new Date().toISOString();
    const id = editingSubject ? editingSubject.id : crypto.randomUUID();
    const subjectData: Subject = {
      id,
      user_id: user.id,
      name: trimmed,
      colour: subjectColour,
      icon: 'BookOpen',
      priority: subjectPriority,
      description: subjectDesc.trim() || undefined,
      created_at: editingSubject ? editingSubject.created_at : now,
      updated_at: now,
      version: editingSubject ? (editingSubject.version || 1) + 1 : 1
    };

    await db.subjects.put(subjectData);
    await enqueueMutation('subjects', id, 'UPSERT', subjectData);

    setShowSubjectModal(false);
    if (!selectedSubjectId) {
      setSelectedSubjectId(id);
    }
  };

  // Delete / Archive Subject
  const handleDeleteSubject = async (subject: Subject) => {
    if (!user) return;
    const subjChapters = activeChapters.filter(c => c.subject_id === subject.id);
    const message = subjChapters.length > 0 
      ? `This subject contains ${subjChapters.length} chapter(s). Are you sure you want to remove it?`
      : `Remove "${subject.name}"?`;

    if (!window.confirm(message)) return;

    const now = new Date().toISOString();
    const tombstone = {
      ...subject,
      deleted_at: now,
      updated_at: now,
      version: (subject.version || 1) + 1
    };

    await db.subjects.put(tombstone);
    await enqueueMutation('subjects', subject.id, 'DELETE', tombstone);

    if (selectedSubjectId === subject.id) {
      setSelectedSubjectId(null);
    }
  };

  // Chapters CRUD
  const openNewChapterModal = () => {
    if (!selectedSubjectId) return;
    setEditingChapter(null);
    setChapterTitle('');
    setChapterPriority('Medium');
    setChapterDeadline('');
    setChapterNotes('');
    setChapterStatus('Not Started');
    setShowChapterModal(true);
  };

  const openEditChapterModal = (ch: Chapter) => {
    setEditingChapter(ch);
    setChapterTitle(ch.title);
    setChapterPriority(ch.priority);
    setChapterDeadline(ch.deadline || '');
    setChapterNotes(ch.notes || '');
    setChapterStatus(ch.status);
    setShowChapterModal(true);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSubjectId || !chapterTitle.trim()) return;

    const now = new Date().toISOString();
    const id = editingChapter ? editingChapter.id : crypto.randomUUID();
    const chapterData: Chapter = {
      id,
      user_id: user.id,
      subject_id: selectedSubjectId,
      title: chapterTitle.trim(),
      status: chapterStatus,
      priority: chapterPriority,
      deadline: chapterDeadline || undefined,
      notes: chapterNotes.trim() || undefined,
      sort_order: editingChapter ? editingChapter.sort_order : activeChapters.length,
      created_at: editingChapter ? editingChapter.created_at : now,
      updated_at: now,
      version: editingChapter ? (editingChapter.version || 1) + 1 : 1
    };

    await db.chapters.put(chapterData);
    await enqueueMutation('chapters', id, 'UPSERT', chapterData);

    // If chapter completed, award 20 XP
    if (chapterStatus === 'Completed') {
      const awarded = await awardXP(
        user.id,
        'chapter',
        id,
        20,
        `Completed Chapter: ${chapterData.title}`,
        `chapter_${id}`,
        enqueueMutation
      );

      if (awarded) {
        confetti({ particleCount: 35, spread: 50 });
      }

      // Check if entire subject completed for 50 XP
      checkSubjectFullCompletion(selectedSubjectId);
    }

    await checkAndUnlockAchievements(user.id, enqueueMutation);
    setShowChapterModal(false);
  };

  const handleUpdateChapterStatus = async (chapter: Chapter, newStatus: ChapterStatus) => {
    if (!user) return;
    const now = new Date().toISOString();
    const updated = {
      ...chapter,
      status: newStatus,
      updated_at: now,
      version: (chapter.version || 1) + 1
    };

    await db.chapters.put(updated);
    await enqueueMutation('chapters', chapter.id, 'UPSERT', updated);

    if (newStatus === 'Completed') {
      const awarded = await awardXP(
        user.id,
        'chapter',
        chapter.id,
        20,
        `Completed Chapter: ${chapter.title}`,
        `chapter_${chapter.id}`,
        enqueueMutation
      );
      if (awarded) {
        confetti({ particleCount: 35, spread: 50 });
      }

      checkSubjectFullCompletion(chapter.subject_id);
    }

    await checkAndUnlockAchievements(user.id, enqueueMutation);
  };

  const handleDeleteChapter = async (chapter: Chapter) => {
    if (!user) return;
    if (!window.confirm(`Delete chapter "${chapter.title}"?`)) return;

    const now = new Date().toISOString();
    const tombstone = {
      ...chapter,
      deleted_at: now,
      updated_at: now,
      version: (chapter.version || 1) + 1
    };

    await db.chapters.put(tombstone);
    await enqueueMutation('chapters', chapter.id, 'DELETE', tombstone);
  };

  // Topics
  const handleAddTopic = async (chapterId: string) => {
    if (!user || !topicTitle.trim()) return;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const topicData: Topic = {
      id,
      user_id: user.id,
      chapter_id: chapterId,
      title: topicTitle.trim(),
      status: 'Not Started',
      sort_order: activeTopics.length,
      created_at: now,
      updated_at: now,
      version: 1
    };

    await db.topics.put(topicData);
    await enqueueMutation('topics', id, 'UPSERT', topicData);

    setTopicTitle('');
    setAddingTopicChapterId(null);
  };

  const handleUpdateTopicStatus = async (topic: Topic, newStatus: ChapterStatus) => {
    if (!user) return;
    const now = new Date().toISOString();
    const updated = {
      ...topic,
      status: newStatus,
      updated_at: now,
      version: (topic.version || 1) + 1
    };

    await db.topics.put(updated);
    await enqueueMutation('topics', topic.id, 'UPSERT', updated);
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (!user) return;
    const now = new Date().toISOString();
    const tombstone = {
      ...topic,
      deleted_at: now,
      updated_at: now,
      version: (topic.version || 1) + 1
    };

    await db.topics.put(tombstone);
    await enqueueMutation('topics', topic.id, 'DELETE', tombstone);
  };

  // Check if subject is 100% completed
  const checkSubjectFullCompletion = async (subjId: string) => {
    if (!user) return;
    const stats = getSubjectStats(subjId);
    if (stats.totalItems > 0 && stats.percent === 100) {
      const subj = activeSubjects.find(s => s.id === subjId);
      const awarded = await awardXP(
        user.id,
        'subject',
        subjId,
        50,
        `Mastered Entire Subject: ${subj?.name || 'Subject'}`,
        `subject_master_${subjId}`,
        enqueueMutation
      );
      if (awarded) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      }
    }
  };

  const toggleAccordion = (chId: string) => {
    const next = new Set(expandedChapterIds);
    if (next.has(chId)) {
      next.delete(chId);
    } else {
      next.add(chId);
    }
    setExpandedChapterIds(next);
  };

  const currentSubject = activeSubjects.find(s => s.id === selectedSubjectId);
  const currentChapters = selectedSubjectId ? activeChapters.filter(c => c.subject_id === selectedSubjectId) : [];

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-500" />
            <span>Curriculum & Subjects</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Organise academic subjects, chapters, syllabus topics, and notes.
          </p>
        </div>

        <button
          onClick={openNewSubjectModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Subjects Horizontal Pill / Card Selector */}
      {activeSubjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
            No subjects created yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Create your first academic subject (e.g. Mathematics, Biology, Computer Science) to map out chapters and track syllabus completion.
          </p>
          <button
            onClick={openNewSubjectModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Subject</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeSubjects.map((subj) => {
            const stats = getSubjectStats(subj.id);
            const isSelected = selectedSubjectId === subj.id;
            const focusHours = (stats.focusSeconds / 3600).toFixed(1);

            return (
              <div
                key={subj.id}
                onClick={() => setSelectedSubjectId(subj.id)}
                className={`cursor-pointer p-4 rounded-3xl border transition shadow-sm relative overflow-hidden group ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Accent top bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: subj.colour }}
                />

                <div className="flex items-start justify-between mt-1 mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: subj.colour }}
                    />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {subj.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditSubjectModal(subj);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubject(subj);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {subj.description && (
                  <p className="text-xs text-slate-400 truncate mb-3">
                    {subj.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>Syllabus: {stats.percent}%</span>
                    <span>{stats.completedItems}/{stats.totalItems} items</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${stats.percent}%`, backgroundColor: subj.colour }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{focusHours}h studied</span>
                  </span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {subj.priority} Priority
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chapters & Syllabus Details Section for Selected Subject */}
      {currentSubject && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: currentSubject.colour }}
                />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {currentSubject.name} — Syllabus & Chapters
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage chapters, status, revision needs, and individual topics.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openNewChapterModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-100 transition border border-emerald-200 dark:border-emerald-900"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chapter</span>
              </button>
            </div>
          </div>

          {currentChapters.length === 0 ? (
            <div className="py-8 text-center">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No chapters added for {currentSubject.name}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                Break this subject down into chapters or modules to track your progress.
              </p>
              <button
                onClick={openNewChapterModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Chapter</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentChapters.map((ch) => {
                const isExpanded = expandedChapterIds.has(ch.id);
                const chTopics = activeTopics.filter(t => t.chapter_id === ch.id);
                const completedTopics = chTopics.filter(t => t.status === 'Completed').length;
                const isCompleted = ch.status === 'Completed';

                const statusColors: Record<ChapterStatus, string> = {
                  'Not Started': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                  'In Progress': 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900',
                  'Revision Required': 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900',
                  'Needs Practice': 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-900',
                  'Completed': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                };

                return (
                  <div
                    key={ch.id}
                    className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-850"
                  >
                    {/* Chapter Header Card */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => toggleAccordion(ch.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        <div className="min-w-0">
                          <h4 className={`text-sm font-bold truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {ch.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            {chTopics.length > 0 && (
                              <span>{completedTopics}/{chTopics.length} topics done</span>
                            )}
                            {ch.deadline && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>Due: {ch.deadline}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Status Selector & Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <select
                          value={ch.status}
                          onChange={(e) => handleUpdateChapterStatus(ch, e.target.value as ChapterStatus)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-xl cursor-pointer ${statusColors[ch.status]}`}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Needs Practice">Needs Practice</option>
                          <option value="Revision Required">Revision Required</option>
                          <option value="Completed">Completed (+20 XP)</option>
                        </select>

                        <button
                          onClick={() => openEditChapterModal(ch)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                          title="Edit Chapter"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(ch)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                          title="Delete Chapter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Topics & Notes Area */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                        {ch.notes && (
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                            <span className="font-semibold text-slate-400 block mb-1">Notes:</span>
                            <p className="whitespace-pre-wrap">{ch.notes}</p>
                          </div>
                        )}

                        {/* Topics list */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                            <span>Subtopics ({chTopics.length})</span>
                            <button
                              onClick={() => {
                                setAddingTopicChapterId(ch.id);
                                setTopicTitle('');
                              }}
                              className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Subtopic</span>
                            </button>
                          </div>

                          {addingTopicChapterId === ch.id && (
                            <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-300 dark:border-emerald-800">
                              <input
                                type="text"
                                autoFocus
                                value={topicTitle}
                                onChange={(e) => setTopicTitle(e.target.value)}
                                placeholder="Subtopic title..."
                                className="w-full text-xs bg-transparent focus:outline-none dark:text-white"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddTopic(ch.id);
                                }}
                              />
                              <button
                                onClick={() => handleAddTopic(ch.id)}
                                className="px-2 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setAddingTopicChapterId(null)}
                                className="px-2 py-1 text-slate-400 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {chTopics.length === 0 && addingTopicChapterId !== ch.id && (
                            <p className="text-[11px] text-slate-400 italic">
                              No subtopics yet. Chapter completion will determine syllabus progress.
                            </p>
                          )}

                          {chTopics.map((top) => {
                            const isTopicDone = top.status === 'Completed';
                            return (
                              <div
                                key={top.id}
                                className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isTopicDone}
                                    onChange={(e) => handleUpdateTopicStatus(top, e.target.checked ? 'Completed' : 'Not Started')}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className={isTopicDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                                    {top.title}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteTopic(top)}
                                  className="text-slate-400 hover:text-rose-500"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Subject Create / Edit */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingSubject ? 'Edit Subject' : 'Create Academic Subject'}
            </h3>

            {duplicateWarning && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>{duplicateWarning}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                  >
                    Change Name
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSaveSubject(e as any, true)}
                    className="px-2 py-1 rounded bg-amber-600 text-white font-bold text-xs"
                  >
                    Confirm Duplicate
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={(e) => handleSaveSubject(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  value={subjectName}
                  onChange={(e) => {
                    setSubjectName(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  placeholder="e.g. Mathematics, Biology, History"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject Colour
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLOURS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSubjectColour(col)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                        subjectColour === col ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {subjectColour === col && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={subjectPriority}
                  onChange={(e) => setSubjectPriority(e.target.value as Priority)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Description
                </label>
                <textarea
                  value={subjectDesc}
                  onChange={(e) => setSubjectDesc(e.target.value)}
                  placeholder="Brief description or focus area..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chapter Create / Edit */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingChapter ? 'Edit Chapter' : 'Add Chapter / Unit'}
            </h3>

            <form onSubmit={handleSaveChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chapter Title *
                </label>
                <input
                  type="text"
                  required
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="e.g. Chapter 1: Differential Equations"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={chapterStatus}
                    onChange={(e) => setChapterStatus(e.target.value as ChapterStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Needs Practice">Needs Practice</option>
                    <option value="Revision Required">Revision Required</option>
                    <option value="Completed">Completed (+20 XP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={chapterPriority}
                    onChange={(e) => setChapterPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Deadline
                </label>
                <input
                  type="date"
                  value={chapterDeadline}
                  onChange={(e) => setChapterDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Personal Study Notes / Key Formulas
                </label>
                <textarea
                  value={chapterNotes}
                  onChange={(e) => setChapterNotes(e.target.value)}
                  placeholder="Key concepts, page references, formula reminders..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                >
                  Save Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
