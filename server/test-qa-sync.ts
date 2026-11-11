import { app } from './src/app.js';
import http from 'node:http';

async function runQATests() {
  console.log('========================================================================');
  console.log('   LEVEL UP — QA MULTI-DEVICE 100% SYNCHRONIZATION SIMULATION');
  console.log('========================================================================\n');

  // Start temporary local server on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[QA Server] Running on ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    const userEmail = 'laabheshthallam@gmail.com';
    const userPassword = 'secret_password_123';
    const userName = 'Laabhesh';

    // -------------------------------------------------------------------------
    // TEST STEP 1: Device 1 (Laptop) registers account
    // -------------------------------------------------------------------------
    console.log('[Step 1] Device 1 (Laptop) registers account...');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
        display_name: userName,
        timezone: 'Asia/Kolkata'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 200 && !!regData.token, 'Device 1 registration returns 200 & JWT token');
    const device1Token = regData.token;
    const userId = regData.user.id;

    // Ensure clean state for the test user
    await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device1Token}`
      },
      body: JSON.stringify({ confirmation: 'DELETE ALL MY DATA' })
    });

    // -------------------------------------------------------------------------
    // TEST STEP 2: Device 1 creates Subject, Chapter, Exam, Goal, and 25 Tasks
    // -------------------------------------------------------------------------
    console.log('\n[Step 2] Device 1 creates Subject, Chapter, Exam, Goal, and 25 distinct Tasks...');
    const now = new Date().toISOString();
    const runId = Date.now();
    const subjectId = `subj_math_${runId}`;
    const chapterId = `chap_calc_${runId}`;

    const mutations: any[] = [
      {
        operation_id: `op_${runId}_subj_1`,
        entity: 'subjects',
        entity_id: subjectId,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: subjectId,
          name: 'Advanced Mathematics',
          colour: '#3B82F6',
          icon: 'Calculator',
          priority: 'High',
          description: 'Calculus and Linear Algebra',
          created_at: now,
          updated_at: now,
          version: 1
        }
      },
      {
        operation_id: `op_${runId}_chap_1`,
        entity: 'chapters',
        entity_id: chapterId,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: chapterId,
          subject_id: subjectId,
          title: 'Differential Calculus',
          status: 'In Progress',
          notes: 'Focus on Chain Rule and Implicit Differentiation',
          priority: 'High',
          sort_order: 1,
          created_at: now,
          updated_at: now,
          version: 1
        }
      },
      {
        operation_id: `op_${runId}_goal_1`,
        entity: 'goals',
        entity_id: `goal_daily_${runId}`,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: `goal_daily_${runId}`,
          period: 'Daily',
          type: 'Study Time',
          target: 120,
          unit: 'minutes',
          subject_id: subjectId,
          current_progress: 45,
          status: 'In Progress',
          created_at: now,
          updated_at: now,
          version: 1
        }
      },
      {
        operation_id: `op_${runId}_exam_1`,
        entity: 'exams',
        entity_id: `exam_midterm_${runId}`,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: `exam_midterm_${runId}`,
          subject_id: subjectId,
          exam_at: '2026-12-15',
          exam_time: '10:00 AM',
          location: 'Hall A',
          preparation_status: 'In Progress',
          notes: 'Chapters 1-5',
          created_at: now,
          updated_at: now,
          version: 1
        }
      }
    ];

    // Generate exactly 25 distinct tasks
    for (let i = 1; i <= 25; i++) {
      const taskId = `task_${runId}_${i.toString().padStart(2, '0')}`;
      mutations.push({
        operation_id: `op_${runId}_task_${i}`,
        entity: 'tasks',
        entity_id: taskId,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: taskId,
          title: `Task ${i}: Study Calculus Section ${i}.0`,
          description: `Detailed study and problem set for section ${i}`,
          subject_id: subjectId,
          chapter_id: chapterId,
          due_at: '2026-11-20',
          priority: i % 2 === 0 ? 'High' : 'Medium',
          status: 'To Do',
          estimated_minutes: 30,
          created_at: now,
          updated_at: now,
          version: 1
        }
      });
    }

    const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        device_id: 'dev_laptop_1',
        mutations
      })
    });
    const pushData = await pushRes.json();
    assert(pushRes.status === 200, 'Device 1 push returns HTTP 200');
    assert(
      Array.isArray(pushData.acknowledgedOperationIds) && pushData.acknowledgedOperationIds.length === 29,
      'Device 1 server acknowledges all 29 entities (25 tasks + 1 subject + 1 chapter + 1 goal + 1 exam)',
      `Acknowledged: ${pushData.acknowledgedOperationIds?.length}`
    );

    // -------------------------------------------------------------------------
    // TEST STEP 3: Device 1 starts a 25-minute Focus Mode timer
    // -------------------------------------------------------------------------
    console.log('\n[Step 3] Device 1 starts 25-minute Focus Timer...');
    const timerStartMs = Date.now();
    // 25 minutes = 1500 seconds
    const totalDurationSeconds = 25 * 60;
    const targetEndMs = timerStartMs + totalDurationSeconds * 1000;

    const timerStartRes = await fetch(`${baseUrl}/api/timer/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        mode: 'focus',
        status: 'running',
        subjectId,
        topicId: null,
        sessionType: 'Study',
        notes: 'Calculus Section 1',
        plannedMinutes: 25,
        targetEndTime: targetEndMs,
        remainingSeconds: totalDurationSeconds,
        actualElapsedSeconds: 0,
        sessionStartTime: new Date(timerStartMs).toISOString()
      })
    });
    const timerStartData = await timerStartRes.json();
    assert(timerStartRes.status === 200 && timerStartData.success, 'Device 1 starts active timer on server');

    // -------------------------------------------------------------------------
    // TEST STEP 4: Simulate 10 Minutes Elapsed (600s) out of 25 Minutes
    // -------------------------------------------------------------------------
    console.log('\n[Step 4] Simulating 10 minutes (600 seconds) elapsed since Device 1 started timer...');
    // When 10 minutes elapse, targetEndTime remains (timerStartMs + 25m).
    // From current wall clock perspective, 15 minutes (900s) should remain.
    // We adjust targetEndTime on server so that Date.now() + 15 minutes is the target end:
    const remainingAfter10Min = 15 * 60; // 900 seconds
    const simulatedTargetEnd = Date.now() + remainingAfter10Min * 1000;
    const simulatedStartTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await fetch(`${baseUrl}/api/timer/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        mode: 'focus',
        status: 'running',
        subjectId,
        topicId: null,
        sessionType: 'Study',
        notes: 'Calculus Section 1',
        plannedMinutes: 25,
        targetEndTime: simulatedTargetEnd,
        remainingSeconds: remainingAfter10Min,
        actualElapsedSeconds: 600,
        sessionStartTime: simulatedStartTime
      })
    });
    console.log('  -> Timer state updated: 10 minutes elapsed, target end is in 15 minutes.');

    // -------------------------------------------------------------------------
    // TEST STEP 5: Device 2 (Phone) logs in with same email & password
    // -------------------------------------------------------------------------
    console.log('\n[Step 5] Device 2 (Phone) logs in with same credentials...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
        device_label: 'Device 2 (Phone)'
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && !!loginData.token, 'Device 2 login returns 200 & JWT token');
    const device2Token = loginData.token;
    assert(loginData.user.id === userId, 'Device 2 is authenticated as the identical user ID');

    // -------------------------------------------------------------------------
    // TEST STEP 6: Device 2 pulls cloud state (initial cursor = 0)
    // -------------------------------------------------------------------------
    console.log('\n[Step 6] Device 2 pulls full state from server (cursor = 0)...');
    const pullRes = await fetch(`${baseUrl}/api/sync/pull?cursor=0`, {
      headers: { 'Authorization': `Bearer ${device2Token}` }
    });
    const pullData = await pullRes.json();
    assert(pullRes.status === 200, 'Device 2 pull returns HTTP 200');

    const pulledTasks = pullData.entities?.tasks || [];
    assert(pulledTasks.length === 25, `Device 2 receives EXACTLY 25 tasks created on Device 1 (got ${pulledTasks.length})`);
    
    // Verify tasks details
    const taskTitles = pulledTasks.map((t: any) => t.title);
    const hasTask1 = taskTitles.includes('Task 1: Study Calculus Section 1.0');
    const hasTask25 = taskTitles.includes('Task 25: Study Calculus Section 25.0');
    assert(hasTask1 && hasTask25, 'Device 2 has Task 1 through Task 25 with correct titles and metadata');

    // Verify other categories
    const pulledSubjects = pullData.entities?.subjects || [];
    const pulledChapters = pullData.entities?.chapters || [];
    const pulledGoals = pullData.entities?.goals || [];
    const pulledExams = pullData.entities?.exams || [];
    assert(pulledSubjects.length >= 1 && pulledSubjects[0].name === 'Advanced Mathematics', 'Device 2 receives Subject "Advanced Mathematics"');
    assert(pulledChapters.length >= 1 && pulledChapters[0].title === 'Differential Calculus', 'Device 2 receives Chapter "Differential Calculus"');
    assert(pulledGoals.length >= 1 && pulledGoals[0].target === 120, 'Device 2 receives Goal (120 minutes)');
    assert(pulledExams.length >= 1 && pulledExams[0].location === 'Hall A', 'Device 2 receives Exam ("Hall A")');

    // -------------------------------------------------------------------------
    // TEST STEP 7: Device 2 checks Active Timer
    // -------------------------------------------------------------------------
    console.log('\n[Step 7] Device 2 checks Active Timer...');
    const timerCheckRes = await fetch(`${baseUrl}/api/timer/active`, {
      headers: { 'Authorization': `Bearer ${device2Token}` }
    });
    const timerCheckData = await timerCheckRes.json();
    assert(timerCheckRes.status === 200, 'Device 2 gets active timer with HTTP 200');
    assert(timerCheckData.active === true, 'Device 2 active timer is flagged as active');
    assert(timerCheckData.timer?.status === 'running', 'Device 2 active timer status is "running"');
    assert(timerCheckData.timer?.mode === 'focus', 'Device 2 active timer mode is "focus"');
    assert(timerCheckData.timer?.plannedMinutes === 25, 'Device 2 planned minutes is 25');

    const remainingSec = timerCheckData.timer?.remainingSeconds;
    // Tolerance: 900 seconds ± 2 seconds for execution time
    const matches15Min = remainingSec >= 898 && remainingSec <= 902;
    const remainingFormatted = `${Math.floor(remainingSec / 60)}:${(remainingSec % 60).toString().padStart(2, '0')}`;
    assert(
      matches15Min,
      `Device 2 defaults to EXACTLY 15 minutes left (${remainingFormatted} remaining, expected 900s, got ${remainingSec}s)`,
      `Remaining: ${remainingSec}s`
    );

    // -------------------------------------------------------------------------
    // TEST STEP 8: Bidirectional Sync (Device 2 completes a task, Device 1 sees it)
    // -------------------------------------------------------------------------
    console.log('\n[Step 8] Device 2 completes Task 1 and syncs back to Device 1...');
    const targetTaskId = `task_${runId}_01`;
    const completeTaskMutations = [
      {
        operation_id: `op_${runId}_complete_task_1`,
        entity: 'tasks',
        entity_id: targetTaskId,
        operation: 'UPSERT',
        version: 2,
        data: {
          id: targetTaskId,
          title: 'Task 1: Study Calculus Section 1.0',
          subject_id: subjectId,
          chapter_id: chapterId,
          status: 'Done',
          completed_at: new Date().toISOString(),
          version: 2
        }
      }
    ];

    const push2Res = await fetch(`${baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device2Token}`
      },
      body: JSON.stringify({
        device_id: 'dev_phone_2',
        mutations: completeTaskMutations
      })
    });
    const push2Data = await push2Res.json();
    assert(push2Res.status === 200 && push2Data.cursor > 0, 'Device 2 push completed with updated cursor');

    // Device 1 pulls delta changes
    const device1PullRes = await fetch(`${baseUrl}/api/sync/pull?cursor=${pushData.cursor}`, {
      headers: { 'Authorization': `Bearer ${device1Token}` }
    });
    const device1PullData = await device1PullRes.json();
    const updatedTask = device1PullData.entities?.tasks?.find((t: any) => t.id === targetTaskId);
    assert(updatedTask && updatedTask.status === 'Done', 'Device 1 pulls delta and sees Task 1 marked as "Done"');

    // -------------------------------------------------------------------------
    // TEST STEP 9: Device 2 clears/resets Active Timer
    // -------------------------------------------------------------------------
    console.log('\n[Step 9] Device 2 clears Active Timer...');
    const timerDelRes = await fetch(`${baseUrl}/api/timer/active`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${device2Token}` }
    });
    assert(timerDelRes.status === 200, 'Device 2 successfully clears active timer');

    const timerFinalCheck = await fetch(`${baseUrl}/api/timer/active`, {
      headers: { 'Authorization': `Bearer ${device1Token}` }
    });
    const timerFinalData = await timerFinalCheck.json();
    assert(timerFinalData.active === false, 'Device 1 confirms active timer is now idle/cleared');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`   QA SIMULATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runQATests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
