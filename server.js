const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow requests from GitHub Pages
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database file path
const DB_PATH = path.join(__dirname, 'data.json');

// Load database
function loadDatabase() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading database:', error);
    return {
      users: [],
      appointments: [],
      posts: [],
      ratings: [],
      availableSlots: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
    };
  }
}

// Save database
function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'The Good Physio API is running',
    endpoints: ['/api/database', '/api/login', '/api/register', '/api/appointments', '/api/posts', '/api/ratings']
  });
});

// GET: Get entire database
app.get('/api/database', (req, res) => {
  const db = loadDatabase();
  res.json(db);
});

// POST: Save entire database
app.post('/api/database', (req, res) => {
  const success = saveDatabase(req.body);
  if (success) {
    res.json({ success: true, message: 'Database saved' });
  } else {
    res.status(500).json({ error: 'Failed to save database' });
  }
});

// POST: Login
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  const db = loadDatabase();
  
  const user = db.users.find(u => u.email === email && u.password === password && u.role === role);
  
  if (user) {
    // Don't send password back
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// POST: Register
app.post('/api/register', (req, res) => {
  const db = loadDatabase();
  const newUser = req.body;
  
  // Check if email exists
  if (newUser.email && db.users.find(u => u.email === newUser.email)) {
    return res.json({ success: false, message: 'Email already exists' });
  }
  
  // Generate ID
  const prefix = newUser.role === 'doctor' ? 'DOC' : 'PAT';
  const count = db.users.filter(u => u.role === newUser.role).length + 1;
  newUser.id = prefix + String(count).padStart(3, '0');
  
  // Set metadata
  newUser.created = new Date().toISOString().split('T')[0];
  newUser.name = [newUser.firstname, newUser.middlename, newUser.surname].filter(Boolean).join(' ');
  newUser.medicalHistory = newUser.medicalHistory || [];
  
  db.users.push(newUser);
  
  if (saveDatabase(db)) {
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
  } else {
    res.status(500).json({ error: 'Failed to save user' });
  }
});

// GET: Get appointments for user
app.get('/api/appointments/:userId', (req, res) => {
  const db = loadDatabase();
  const { userId } = req.params;
  const appointments = db.appointments.filter(a => a.patientId === userId || a.doctorId === userId);
  res.json(appointments);
});

// POST: Create appointment
app.post('/api/appointments', (req, res) => {
  const db = loadDatabase();
  const appointment = req.body;
  
  appointment.id = 'APT' + String(db.appointments.length + 1).padStart(3, '0');
  appointment.created = new Date().toISOString().split('T')[0];
  
  db.appointments.push(appointment);
  
  if (saveDatabase(db)) {
    res.json({ success: true, appointment });
  } else {
    res.status(500).json({ error: 'Failed to save appointment' });
  }
});

// GET: Get all posts
app.get('/api/posts', (req, res) => {
  const db = loadDatabase();
  const { doctorId } = req.query;
  
  if (doctorId) {
    res.json(db.posts.filter(p => p.doctorId === doctorId));
  } else {
    res.json(db.posts);
  }
});

// POST: Create post
app.post('/api/posts', (req, res) => {
  const db = loadDatabase();
  const post = req.body;
  
  post.id = 'POST' + String(db.posts.length + 1).padStart(3, '0');
  post.date = new Date().toISOString().split('T')[0];
  post.time = new Date().toTimeString().split(' ')[0].substring(0, 5);
  
  db.posts.push(post);
  
  if (saveDatabase(db)) {
    res.json({ success: true, post });
  } else {
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// DELETE: Delete post
app.delete('/api/posts/:postId', (req, res) => {
  const db = loadDatabase();
  const { postId } = req.params;
  
  db.posts = db.posts.filter(p => p.id !== postId);
  
  if (saveDatabase(db)) {
    res.json({ success: true, message: 'Post deleted' });
  } else {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// GET: Get ratings
app.get('/api/ratings', (req, res) => {
  const db = loadDatabase();
  const { patientId } = req.query;
  
  if (patientId) {
    res.json(db.ratings.filter(r => r.patientId === patientId));
  } else {
    res.json(db.ratings);
  }
});

// POST: Submit rating
app.post('/api/ratings', (req, res) => {
  const db = loadDatabase();
  const rating = req.body;
  
  rating.id = 'RATE' + String(db.ratings.length + 1).padStart(3, '0');
  rating.date = new Date().toISOString().split('T')[0];
  
  db.ratings = db.ratings || [];
  db.ratings.push(rating);
  
  if (saveDatabase(db)) {
    res.json({ success: true, rating });
  } else {
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// DELETE: Delete rating
app.delete('/api/ratings/:ratingId', (req, res) => {
  const db = loadDatabase();
  const { ratingId } = req.params;
  
  db.ratings = db.ratings.filter(r => r.id !== ratingId);
  
  if (saveDatabase(db)) {
    res.json({ success: true, message: 'Rating deleted' });
  } else {
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

// PUT: Update user (password change, etc.)
app.put('/api/users/:userId', (req, res) => {
  const db = loadDatabase();
  const { userId } = req.params;
  const updates = req.body;
  
  const userIndex = db.users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Update user fields
  db.users[userIndex] = { ...db.users[userIndex], ...updates };
  
  if (saveDatabase(db)) {
    const { password: _, ...userWithoutPassword } = db.users[userIndex];
    res.json({ success: true, user: userWithoutPassword });
  } else {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE: Delete account
app.delete('/api/users/:userId', (req, res) => {
  const db = loadDatabase();
  const { userId } = req.params;
  
  // Remove user
  db.users = db.users.filter(u => u.id !== userId);
  
  // Remove associated data
  db.appointments = db.appointments.filter(a => a.patientId !== userId && a.doctorId !== userId);
  db.posts = db.posts.filter(p => p.doctorId !== userId);
  db.ratings = db.ratings.filter(r => r.patientId !== userId);
  
  if (saveDatabase(db)) {
    res.json({ success: true, message: 'Account deleted' });
  } else {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🏥 The Good Physio API running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
});
