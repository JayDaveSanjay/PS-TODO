import express from 'express';
import path from 'path';
import { TEAM, Task, Comment, TeamMember } from './src/types.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const app = express();
const PORT = 3000;

const PROJECT_ID = 'gen-lang-client-0536094647';
const DATABASE_ID = 'ai-studio-printstopcotaskb-21010a36-617c-41dd-9ef0-13de9702d427';

// Initialize Firebase Admin securely for both local, Vercel, and Cloud Run environments
if (getApps().length === 0) {
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: PROJECT_ID,
      });
      console.log('Firebase Admin successfully initialized using FIREBASE_SERVICE_ACCOUNT from environment.');
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable, falling back to default:', e);
      initializeApp({
        projectId: PROJECT_ID,
      });
    }
  } else {
    initializeApp({
      projectId: PROJECT_ID,
    });
    console.log('Firebase Admin initialized with default credentials/Application Default Credentials.');
  }
}

const db = getFirestore(DATABASE_ID);

// Firestore database helpers
async function getTasks(): Promise<Task[]> {
  const snapshot = await db.collection('tasks').get();
  const tasks: Task[] = [];
  snapshot.forEach(doc => {
    const data = doc.data() as Task;
    // Ensure comments, assistingIds, and dependencies arrays exist
    if (!data.comments) data.comments = [];
    if (!data.assistingIds) data.assistingIds = [];
    if (!data.dependencies) data.dependencies = [];
    tasks.push(data);
  });
  return tasks;
}

async function saveTask(task: Task): Promise<void> {
  await db.collection('tasks').doc(task.id).set(task);
}

async function deleteTask(taskId: string): Promise<void> {
  await db.collection('tasks').doc(taskId).delete();
}

async function getUserPin(memberId: string): Promise<string | null> {
  const pinDoc = await db.collection('user_pins').doc(memberId).get();
  return pinDoc.exists ? pinDoc.data()?.pin || null : null;
}

async function setUserPin(memberId: string, pin: string): Promise<void> {
  await db.collection('user_pins').doc(memberId).set({ pin });
}

// Seed helper (default fallback)
function getSeedTasks(): Task[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'task-1',
      title: 'Source 300 GSM Premium Art Card Stock',
      description: 'Need quotes from at least 3 suppliers in Mumbai for urgent visiting card bulk printing. Target rate is < ₹4.20 per sheet.',
      ownerId: 'dipak',
      status: 'In Progress',
      priority: 'high',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
      assistingIds: ['pundalik'],
      dependencies: [],
      comments: [
        {
          id: 'c-1',
          taskId: 'task-1',
          authorId: 'pundalik',
          text: 'Spoke to Kalpataru Paper; they quoted ₹4.50, negotiating for ₹4.15 if order is above 50 reams.',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'task-2',
      title: 'Bulk Cotton T-Shirt Sourcing for Corporate Kit',
      description: 'Vendor selection for 2000 t-shirts (180 GSM, 100% cotton). Must receive pre-production samples by end of week.',
      ownerId: 'karan',
      status: 'To Do',
      priority: 'high',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assistingIds: ['pratiksha'],
      dependencies: [],
      comments: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'task-3',
      title: 'Quality Inspection of Premium Diary Samples',
      description: 'Inspect the PU leather cover stitching, binding quality, and inner page thickness (80 GSM Maplitho).',
      ownerId: 'pratiksha',
      status: 'To Do',
      priority: 'med',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assistingIds: ['savijjith'],
      dependencies: ['task-1'], // Blocked by card stock selection or related task
      comments: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'task-4',
      title: 'GRN Verification for Vinyl Banner Consignment',
      description: 'Confirm physical roll count and check for surface wrinkles on arrival of 44-inch roll shipment.',
      ownerId: 'prakash',
      status: 'To Do',
      priority: 'low',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assistingIds: [],
      dependencies: [],
      comments: [],
      createdAt: now,
      updatedAt: now
    }
  ];
}

// Seed the Cloud database if it has no tasks
async function seedIfNeeded() {
  try {
    const tasks = await getTasks();
    if (tasks.length === 0) {
      console.log('No tasks found in Cloud Firestore. Seeding initial tasks...');
      const seedTasks = getSeedTasks();
      for (const t of seedTasks) {
        await saveTask(t);
      }
      console.log('Seeding completed successfully!');
    } else {
      console.log(`Cloud Firestore holds ${tasks.length} active tasks.`);
    }
  } catch (error) {
    console.error('Failed to check/seed tasks in Firestore:', error);
  }
}

// Express JSON body parser
app.use(express.json());

// API: Auth Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, pin } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and Phone number are required' });
    }

    // Find member (case insensitive email, normalized numbers)
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    const member = TEAM.find(m => {
      return m.email.toLowerCase() === normalizedEmail && m.phone.replace(/\s+/g, '') === normalizedPhone;
    });

    if (!member) {
      return res.status(401).json({ error: 'Access denied: You are not registered as a PrintStop team member.' });
    }

    // Check PIN setup
    const existingPin = await getUserPin(member.id);

    if (!existingPin) {
      // PIN not set up yet! Require them to set it up
      if (!pin) {
        return res.status(200).json({
          setupRequired: true,
          member: { id: member.id, name: member.name, email: member.email, phone: member.phone }
        });
      } else {
        // Set the PIN
        const cleanPin = pin.trim();
        if (cleanPin.length < 4) {
          return res.status(400).json({ error: 'PIN must be at least 4 digits' });
        }
        await setUserPin(member.id, cleanPin);
        return res.status(200).json({
          success: true,
          member: { id: member.id, name: member.name, email: member.email, phone: member.phone }
        });
      }
    }

    // PIN already setup, verify it
    if (!pin) {
      return res.status(200).json({
        pinRequired: true,
        member: { id: member.id, name: member.name, email: member.email }
      });
    }

    if (existingPin !== pin.trim()) {
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      member: { id: member.id, name: member.name, email: member.email, phone: member.phone }
    });
  } catch (error: any) {
    console.error('Error in /api/auth/login:', error);
    return res.status(500).json({ error: `Server error during login: ${error.message || error}` });
  }
});

// API: Auth Reset PIN
app.post('/api/auth/reset-pin', async (req, res) => {
  try {
    const { email, phone, newPin } = req.body;
    if (!email || !phone || !newPin) {
      return res.status(400).json({ error: 'Email, phone, and new PIN are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim().replace(/\s+/g, '');

    const member = TEAM.find(m => {
      return m.email.toLowerCase() === normalizedEmail && m.phone.replace(/\s+/g, '') === normalizedPhone;
    });

    if (!member) {
      return res.status(401).json({ error: 'Verification failed. Incorrect email or phone number.' });
    }

    const cleanPin = newPin.trim();
    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits' });
    }

    await setUserPin(member.id, cleanPin);

    return res.status(200).json({
      success: true,
      message: 'Your PIN has been successfully reset. You can now log in.'
    });
  } catch (error: any) {
    console.error('Error in /api/auth/reset-pin:', error);
    return res.status(500).json({ error: `Server error during PIN reset: ${error.message || error}` });
  }
});

// API: Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await getTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks from Firestore:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// API: Create new task
app.post('/api/tasks', async (req, res) => {
  const { title, description, ownerId, status, priority, dueDate, assistingIds, dependencies, waitingPersonId } = req.body;

  if (!title || !ownerId) {
    return res.status(400).json({ error: 'Title and Owner are required' });
  }

  const newTask: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: title.trim(),
    description: (description || '').trim(),
    ownerId,
    status: status || 'To Do',
    priority: priority || 'med',
    dueDate: dueDate || '',
    assistingIds: assistingIds || [],
    dependencies: dependencies || [],
    waitingPersonId: waitingPersonId || ownerId,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await saveTask(newTask);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task in Firestore:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// API: Update task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, ownerId, status, priority, dueDate, assistingIds, dependencies, waitingPersonId } = req.body;

  try {
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const existingTask = taskDoc.data() as Task;

    const updatedTask: Task = {
      ...existingTask,
      title: title !== undefined ? title.trim() : existingTask.title,
      description: description !== undefined ? description.trim() : existingTask.description,
      ownerId: ownerId || existingTask.ownerId,
      status: status || existingTask.status,
      priority: priority || existingTask.priority,
      dueDate: dueDate !== undefined ? dueDate : existingTask.dueDate,
      assistingIds: assistingIds || existingTask.assistingIds,
      dependencies: dependencies || existingTask.dependencies,
      waitingPersonId: waitingPersonId !== undefined ? waitingPersonId : existingTask.waitingPersonId,
      updatedAt: new Date().toISOString()
    };

    await saveTask(updatedTask);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task in Firestore:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// API: Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Remove this task from dependencies of all other tasks in Firestore
    const allTasks = await getTasks();
    for (const t of allTasks) {
      if (t.dependencies && t.dependencies.includes(id)) {
        t.dependencies = t.dependencies.filter(depId => depId !== id);
        await saveTask(t);
      }
    }

    await deleteTask(id);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task from Firestore:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// API: Add comment to task
app.post('/api/tasks/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { authorId, text } = req.body;

  if (!authorId || !text) {
    return res.status(400).json({ error: 'Author and text are required' });
  }

  try {
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskDoc.data() as Task;

    const newComment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId: id,
      authorId,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    if (!task.comments) {
      task.comments = [];
    }
    task.comments.push(newComment);
    task.updatedAt = new Date().toISOString();

    await saveTask(task);
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment in Firestore:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// API: Delete comment from task
app.delete('/api/tasks/:taskId/comments/:commentId', async (req, res) => {
  const { taskId, commentId } = req.params;

  try {
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskDoc.data() as Task;

    if (!task.comments) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const commentIndex = task.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    task.comments.splice(commentIndex, 1);
    task.updatedAt = new Date().toISOString();

    await saveTask(task);
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment in Firestore:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Serve frontend with Vite setup
async function startServer() {
  // Run seed verification
  await seedIfNeeded();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrintStop Co-Task Server listening on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
