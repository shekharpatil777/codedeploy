// -------------------------------------------------------------------
// FILE: server.js
// -------------------------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

// In-memory data store for simplicity
let tasks = [
    { id: 1, text: 'Sample Task 1: Buy groceries' },
    { id: 2, text: 'Sample Task 2: Finish report' }
];
let nextId = 3;

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from the root directory

// API to get all tasks
app.get('/tasks', (req, res) => {
    res.json(tasks);
});

// API to add a new task
app.post('/tasks', (req, res) => {
    if (!req.body || !req.body.text) {
        return res.status(400).send('Task text is required.');
    }
    const newTask = {
        id: nextId++,
        text: req.body.text
    };
    tasks.push(newTask);
    console.log(`Added new task: ${newTask.text}`);
    res.status(201).json(newTask);
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
