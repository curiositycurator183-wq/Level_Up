import { app } from './src/app.js';
import http from 'node:http';

async function runQATests() {
  console.log('========================================================================');
  console.log('   LEVEL UP — QA AUTHENTICATION & MULTI-DEVICE 100% SYNC SIMULATION');
  console.log('========================================================================\n');

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
    const runId = Date.now();
    const legitEmail = `laabhesh.${runId}@gmail.com`;
    let userPassword = 'secret_password_123';
    const userName = 'Laabhesh Thallam';

    // -------------------------------------------------------------------------
    // TEST 1: Reject Non-Legit Emails & Weak Passwords
    // -------------------------------------------------------------------------
    console.log('[Test 1] Email & Password Legitimacy Validations...');

    // Fake/disposable email
    const fakeRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@test.com', password: 'password123', display_name: 'Test' })
    });
    assert(fakeRes.status === 400, 'Rejects fake/disposable email domain (fake@test.com)');

    // Malformed email
    const malformedRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-string', password: 'password123', display_name: 'Test' })
    });
    assert(malformedRes.status === 400, 'Rejects malformed email without @ and domain');

    // Weak password (< 6 chars)
    const weakPassRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: '123', display_name: 'Test' })
    });
    assert(weakPassRes.status === 400, 'Rejects password shorter than 6 characters');

    // -------------------------------------------------------------------------
    // TEST 2: Legitimate Account Registration
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Legitimate Account Creation (Device 1)...');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: legitEmail,
        password: userPassword,
        display_name: userName,
        timezone: 'Asia/Kolkata'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 200 && !!regData.token, 'Legitimate account registration returns 200 & JWT token');
    const device1Token = regData.token;
    const userId = regData.user.id;
    assert(regData.user.email === legitEmail, 'Registered user email is accurately persisted');

    // Duplicate registration rejection
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: legitEmail,
        password: userPassword,
        display_name: userName
      })
    });
    assert(dupRes.status === 409, 'Rejects duplicate registration with 409 Conflict');

    // -------------------------------------------------------------------------
    // TEST 3: Strict Login Validations (No Auto-Provisioning Hacks)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Strict Authentication & Security Checks...');

    // Non-existent user login
    const nonExistentRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent.${runId}@gmail.com`, password: 'somepassword' })
    });
    assert(nonExistentRes.status === 401, 'Rejects login for non-existent user with 401 Unauthorized');

    // Wrong password login
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: 'wrongpassword' })
    });
    assert(wrongPassRes.status === 401, 'Rejects login with wrong password');

    // Valid login
    const validLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: userPassword, device_label: 'Device 1 (Laptop)' })
    });
    assert(validLoginRes.status === 200, 'Accepts valid login credentials and issues JWT token');

    // -------------------------------------------------------------------------
    // TEST 4: Forgot Password & Reset via Verification Code Sent to Email
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Password Reset Flow via 6-Digit Email Code...');

    // Request reset code
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail })
    });
    const forgotData = await forgotRes.json();
    assert(forgotRes.status === 200 && forgotData.success, 'Sends 6-digit verification code to registered email');
    const verificationCode = forgotData.previewCode;
    assert(!!verificationCode && /^\d{6}$/.test(verificationCode), `Verification code is a valid 6-digit numeric token (${verificationCode})`);

    // Attempt reset with invalid code
    const invalidCodeRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, code: '000000', new_password: 'new_secret_password_456' })
    });
    assert(invalidCodeRes.status === 400, 'Rejects reset attempt with invalid code');

    // Attempt reset with valid code
    const newPassword = 'new_secret_password_456';
    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, code: verificationCode, new_password: newPassword })
    });
    const resetData = await resetRes.json();
    assert(resetRes.status === 200 && resetData.success && !!resetData.token, 'Resets password and returns new authenticated session');

    // Verify old password no longer works
    const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: userPassword })
    });
    assert(oldLoginRes.status === 401, 'Old password is immediately revoked');

    // Verify new password works
    userPassword = newPassword;
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: userPassword, device_label: 'Device 1 (Laptop)' })
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.status === 200 && newLoginData.user.id === userId, 'Login succeeds with new password across devices');

    // -------------------------------------------------------------------------
    // TEST 5: Device 1 creates Subject, Chapter, Exam, Goal, and 25 Tasks
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Device 1 creates 25 Tasks and Academic Entities...');
    const now = new Date().toISOString();
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
          notes: 'Derivatives & Integrals',
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
        entity_id: `goal_${runId}`,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: `goal_${runId}`,
          period: 'Daily',
          type: 'Study Time',
          target: 120,
          unit: 'minutes',
          subject_id: subjectId,
          current_progress: 30,
          status: 'In Progress',
          created_at: now,
          updated_at: now,
          version: 1
        }
      },
      {
        operation_id: `op_${runId}_exam_1`,
        entity: 'exams',
        entity_id: `exam_${runId}`,
        operation: 'UPSERT',
        version: 1,
        data: {
          id: `exam_${runId}`,
          subject_id: subjectId,
          exam_at: '2026-12-15',
          exam_time: '10:00 AM',
          location: 'Main Hall',
          preparation_status: 'In Progress',
          notes: 'Full Syllabus',
          created_at: now,
          updated_at: now,
          version: 1
        }
      }
    ];

    // Create exactly 25 tasks
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
          title: `Task ${i}: Complete Calculus Chapter ${i}`,
          description: `Problem set ${i} solved completely`,
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
        'Authorization': `Bearer ${newLoginData.token}`
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
      'Device 1 server acknowledges all 29 entities (25 tasks + 1 subject + 1 chapter + 1 goal + 1 exam)'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Device 1 starts 25-minute Focus Mode timer
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Device 1 starts 25-minute Focus Timer...');
    const timerStartMs = Date.now();
    const totalDurationSeconds = 25 * 60; // 1500s
    const targetEndMs = timerStartMs + totalDurationSeconds * 1000;

    await fetch(`${baseUrl}/api/timer/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newLoginData.token}`
      },
      body: JSON.stringify({
        mode: 'focus',
        status: 'running',
        subjectId,
        topicId: null,
        sessionType: 'Study',
        notes: 'Calculus Session',
        plannedMinutes: 25,
        targetEndTime: targetEndMs,
        remainingSeconds: totalDurationSeconds,
        actualElapsedSeconds: 0,
        sessionStartTime: new Date(timerStartMs).toISOString()
      })
    });

    // -------------------------------------------------------------------------
    // TEST 7: Simulate 10 Minutes Elapsed (600s)
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Simulating 10 minutes (600s) elapsed since timer started...');
    const remainingAfter10Min = 15 * 60; // 900 seconds
    const simulatedTargetEnd = Date.now() + remainingAfter10Min * 1000;
    const simulatedStartTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await fetch(`${baseUrl}/api/timer/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newLoginData.token}`
      },
      body: JSON.stringify({
        mode: 'focus',
        status: 'running',
        subjectId,
        topicId: null,
        sessionType: 'Study',
        notes: 'Calculus Session',
        plannedMinutes: 25,
        targetEndTime: simulatedTargetEnd,
        remainingSeconds: remainingAfter10Min,
        actualElapsedSeconds: 600,
        sessionStartTime: simulatedStartTime
      })
    });

    // -------------------------------------------------------------------------
    // TEST 8: Device 2 (Phone) logs in with same email & pulls state
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Device 2 (Phone) logs in and verifies 100% data sync...');
    const phoneLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: legitEmail, password: userPassword, device_label: 'Device 2 (Phone)' })
    });
    const phoneLoginData = await phoneLoginRes.json();
    assert(phoneLoginRes.status === 200, 'Device 2 logs in successfully with same email');
    const device2Token = phoneLoginData.token;

    // Pull cloud state (cursor = 0)
    const pullRes = await fetch(`${baseUrl}/api/sync/pull?cursor=0`, {
      headers: { 'Authorization': `Bearer ${device2Token}` }
    });
    const pullData = await pullRes.json();
    assert(pullRes.status === 200, 'Device 2 pulls full state from cloud');

    const pulledTasks = pullData.entities?.tasks || [];
    assert(pulledTasks.length === 25, `Device 2 receives EXACTLY 25 tasks created on Device 1 (got ${pulledTasks.length})`);
    assert(pullData.entities?.subjects?.length >= 1, 'Device 2 receives Subject');
    assert(pullData.entities?.chapters?.length >= 1, 'Device 2 receives Chapter');
    assert(pullData.entities?.goals?.length >= 1, 'Device 2 receives Goal');
    assert(pullData.entities?.exams?.length >= 1, 'Device 2 receives Exam');

    // -------------------------------------------------------------------------
    // TEST 9: Device 2 checks Active Focus Timer (must show exactly 15m remaining)
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Device 2 checks Active Focus Timer (25m - 10m = 15m left)...');
    const timerCheckRes = await fetch(`${baseUrl}/api/timer/active`, {
      headers: { 'Authorization': `Bearer ${device2Token}` }
    });
    const timerCheckData = await timerCheckRes.json();
    assert(timerCheckRes.status === 200, 'Device 2 fetches active timer');
    assert(timerCheckData.active === true, 'Device 2 detects active timer');
    assert(timerCheckData.timer?.status === 'running', 'Timer status is "running"');
    assert(timerCheckData.timer?.mode === 'focus', 'Timer mode is "focus"');
    assert(timerCheckData.timer?.plannedMinutes === 25, 'Planned duration is 25 minutes');

    const remainingSec = timerCheckData.timer?.remainingSeconds;
    const matches15Min = remainingSec >= 898 && remainingSec <= 902;
    const remainingFormatted = `${Math.floor(remainingSec / 60)}:${(remainingSec % 60).toString().padStart(2, '0')}`;
    assert(
      matches15Min,
      `Device 2 by default displays EXACTLY 15 minutes left (${remainingFormatted} remaining, expected 900s, got ${remainingSec}s)`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Bidirectional Sync (Device 2 completes task, Device 1 sees it)
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] Bidirectional Sync between Device 2 and Device 1...');
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
          title: 'Task 1: Complete Calculus Chapter 1',
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
    assert(push2Res.status === 200, 'Device 2 pushes task completion');

    // Device 1 pulls delta
    const device1PullRes = await fetch(`${baseUrl}/api/sync/pull?cursor=${pushData.cursor}`, {
      headers: { 'Authorization': `Bearer ${newLoginData.token}` }
    });
    const device1PullData = await device1PullRes.json();
    const updatedTask = device1PullData.entities?.tasks?.find((t: any) => t.id === targetTaskId);
    assert(updatedTask && updatedTask.status === 'Done', 'Device 1 pulls delta and observes Task 1 marked as "Done"');

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
