const express = require("express"),
	app = express(),
	passport = require("passport"),
	{ Octokit } = require("@octokit/rest"),
	GithubStrategy = require("passport-github").Strategy,
	{ createAppAuth } = require("@octokit/auth-app"),
	fs = require("fs");

//--------------For Enviourmental Variable

require("dotenv").config();

//-------------Express and Passport Session

app.use(express.json());

//-------------Passport Initialize

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});

passport.use(
	new GithubStrategy(
		{
			clientID: process.env.APP_CLIENT_ID,
			clientSecret: process.env.APP_CLIENT_SECRET,
			callbackURL: process.env.CALLBACK_URL,
		},
		(accessToken, refreshToken, profile, done) => {
			return done(null, profile);
		}
	)
);

//------------Reading the PEM file

const pem = fs.readFileSync(
	"./addlabeltopullrequest.2021-01-01.private-key.pem",
	"utf8"
);

//------------Routes

app.get("/", (req, res) => {
	res.send("home");
});

app.get("/auth/github", passport.authenticate("github"), (req, res) => {
	res.redirect("/");
});

app.get(
	"/auth/github/callback",
	passport.authenticate("github", { failureRedirect: "/" }),
	(req, res) => {
		res.redirect("/");
	}
);

//-----------Payload route for webhook to review when a pull request is generated

app.post("/payload", async (req, res) => {
	const title = req.body.pull_request.title.toLowerCase();
	const owner = req.body.pull_request.head.repo.owner.login;
	const repo = req.body.pull_request.head.repo.name;
	const issue = req.body.pull_request.number;
	const installationId = req.body.installation.id;

	//-----------Generating a Auth token for Octokit
	const auth = createAppAuth({
		appId: process.env.App_ID,
		privateKey: pem,
		installationId: installationId,
		clientId: process.env.APP_CLIENT_ID,
		clientSecret: process.env.APP_CLIENT_SECRET,
	});
	const appAuthentication = await auth({ type: "installation" });
	const token = appAuthentication.token;

	//------------Authenticating Ocktokit
	const octokit = new Octokit({
		auth: token,
	});

	//------------Add Haystack label if the pull_request title has word haystack
	if (title.includes("haystack")) {
		const result = await octokit.issues.addLabels({
			owner,
			repo,
			issue_number: issue,
			labels: ["Haystack"],
		});
	}

	res.sendStatus(200);
});

app.get("/logout", (req, res) => {
	req.logout();
	res.sendStatus(200);
});

app.listen(3000, () => {
	console.log("App listening at port: 3000");
});
