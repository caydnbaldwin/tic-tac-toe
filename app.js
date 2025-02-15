// app.js
// import necessary libraries
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// middleware
// handle form data and json data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// serve static files from `public` folder
app.use(express.static(path.join(__dirname, 'public')));

// session management
// ???
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true
}));

// set views folder
// create absolute file path for front-end
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// MySQL connection
// establish connection with database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'M0nson10!',
    database: 'tic_tac_toe'
});

// routes
// ??? this is the seciton for all of my APIs?
// home page (login)
// load login page
app.get('/', (req, res) => {
    res.render('login.html');
});

// handle login
// ??? this is my login API?
app.post('/login', (req, res) => {
    // get username and password from front-end
    const { username, password } = req.body;
    // create query to find username and password
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    // run query to see if input is found in database
    db.query(sql, [username, password], (err, results) => {
        // ??? How does this error logic work? How is it thrown? Why?
        if (err) throw err;
        // if the query returns results, load that user page
        if (results.length > 0) {
            req.session.user = results[0];
            res.redirect('/profile');
        } else {
            res.send('Invalid credentials. <a href="/">Try again</a>');
        }
    });
});

// register
// load register page
app.get('/register', (req, res) => {
    res.render('register.html');
});

// ??? this is my register API?
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query (sql, [username, password], (err, results) => {
        if (err) {
            res.send('Error during registration.');
        } else {
            res.redirect('/');
        }
    });
});

// render game page
app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    // initialize game
    const gameState = {
        board: [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ],
        currentTurn: 'X',
        against: req.query.against || 'computer'
    };
    // store game stat in session
    req.session.gameState = gameState;
    res.render('game.html', { game: gameState });
});

//  make a move API (called from HTMX)
app.post('/move', (req, res) => {
    if (!req.session.user || !req.session.gameState) return res.sendStatus(403);
    const { row, col } = req.body;
    const game = req.session.gameState;

    // check if move is valid
    if (game.board[row][col] !== '') {
        return res.send('Invalid move');
    }

    // make the move for current player
    game.board[row][col] = game.currentTurn;

    // check for a win or draw
    const winner = checkWinner(game.board);
    if (winner) {
        // update user's stats
        if (winner === 'X') {
            const updateSql = 'UPDATE users SET wins = wins + 1 WHERE id = ?';
            db.query(updateSql, [req.session.user.id]);
        } else {
            const updateSql = 'UPDATE users SET losses = losses + 1 WHERE id = ?'
            db.query(updateSql, [req.session.user.id]);
        }
        req.session.gameState = null;
        return res.send(`<div>Player ${winner} wins! <a href="/profile">Back to profile</a></div>`);
    }

    // switch turns
    game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';

    // if playing against computer and its the computer's turn, computer move
    if (game.against === 'computer' && game.currentTurn === 'O') {
        makeComputerMove(game);
        game.currentTurn = 'X';
        const winnerAfter = checkWinner(game.board);
        if (winnerAfter) {
            if (winnerAfter === 'X') {
                const updateSql = 'UPDATE users SET wins = wins + 1 WHERE id = ?';
                db.query(updateSql, [req.session.user.id]);
            } else {
                const updateSql = 'UPDATE users SET losses = losses + 1 WHERE id = ?'
                db.query(updateSql, [req.session.user.id]);
            }
            req.session.gameState = null;
            return res.send(`<div>Player ${winnerAfter} wins! <a href="/profile">Back to profile</a></div>`);
        }
    }

    // return update board as HTMX
    res.render('partials/board.html', { board: game.board }, (err, html) => {
        if (err) throw err;
        res.send(html);
    });
});

// utility functions for game logic
function checkWinner(board) {
    // check rows, colums, and diagnals for a win
    const line = [
        // rows
        [board[0][0], board[0][1], board[0][2]],
        [board[1][0], board[1][1], board[1][2]],
        [board[2][0], board[2][1], board[2][2]],
        // columns
        [board[0][0], board[1][0], board[2][0]],
        [board[0][1], board[1][1], board[2][1]],
        [board[0][2], board[1][2], board[2][2]],
        // diagnals
        [board[0][0], board[1][1], board[2][2]],
        [board[0][2], board[1][1], board[2][0]],
    ];
    for (const line of lines) {
        if (line[0] && line[0] === line[1] && line[1] === line[2]) {
            return line[0];
        }
    }
    // check for draw if board is full
    return null;
}

function makeComputerMove(game) {
    // pick a random empty cell
    const emptyCells = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (game.board[i][j] === '') {
                emptyCells.push({ i, j });
            }
        }
    }
    if (emptyCells.length === 0) return;
    const move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    game.board[move.i][move.j] = 'O';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});