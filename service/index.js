import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as DB from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

const app = express();
const authCookieName = 'token';

// The service port may be set on the command line
const port = process.argv.length > 2 ? process.argv[2] : 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicPath));

// Router for service endpoints
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Create user
apiRouter.post('/auth/create', async (req, res) => {
	if (await findUser('email', req.body.email)) {
		res.status(409).send({ msg: 'Existing user' });
	} else {
		const user = await createUser(req.body.email, req.body.password);
		setAuthCookie(res, user.token);
		res.send({ email: user.email });
	}
});

// Login
apiRouter.post('/auth/login', async (req, res) => {
	const user = await findUser('email', req.body.email);
	if (user) {
		if (await bcrypt.compare(req.body.password, user.password)) {
			user.token = uuidv4();
			await DB.updateUser(user);
			setAuthCookie(res, user.token);
			res.send({ email: user.email });
			return;
		}
	}
	res.status(401).send({ msg: 'Unauthorized' });
});

// Logout
apiRouter.delete('/auth/logout', async (req, res) => {
	const user = await findUser('token', req.cookies[authCookieName]);
	if (user) {
		await DB.updateUserRemoveAuth(user);
	}
	res.clearCookie(authCookieName);
	res.status(204).end();
});

// Auth middleware
const verifyAuth = async (req, res, next) => {
	const user = await findUser('token', req.cookies[authCookieName]);
	if (user) {
		next();
	} else {
		res.status(401).send({ msg: 'Unauthorized' });
	}
};

// Get scores
apiRouter.get('/scores', verifyAuth, async (req, res) => {
	const scores = await DB.getHighScores();
	res.send(scores);
});

// Submit score
apiRouter.post('/score', verifyAuth, async (req, res) => {
	const scores = await updateScores(req.body);
	res.send(scores);
});

// Error handler
app.use((err, req, res, next) => {
	res.status(500).send({ type: err.name, message: err.message });
});

// Fallback to index.html
app.use((_req, res) => {
	res.sendFile(path.join(publicPath, 'index.html'));
});

// Helpers
async function updateScores(newScore) {
	await DB.addScore(newScore);
	return DB.getHighScores();
}

async function createUser(email, password) {
	const passwordHash = await bcrypt.hash(password, 10);

	const user = {
		email: email,
		password: passwordHash,
		token: uuidv4(),
	};

	await DB.addUser(user);
	return user;
}

async function findUser(field, value) {
	if (!value) return null;

	if (field === 'token') {
		return DB.getUserByToken(value);
	}
	return DB.getUser(value);
}

// Cookie setup
function setAuthCookie(res, authToken) {
	res.cookie(authCookieName, authToken, {
		maxAge: 1000 * 60 * 60 * 24 * 365,
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		sameSite: 'strict',
	});
}

// Start server
app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});