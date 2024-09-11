import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/secrets", async (req, res) => {

  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        `SELECT secret FROM users WHERE email = $1`, //lond secret from database
        [req.user.email]
      );
      console.log(result);
      const secret = result.rows[0].secret;
      if (secret) {
        res.render("secrets.ejs", { secret: secret });
      } else {
        res.render("secrets.ejs", { secret: "Secrets is Empty but Hart is too Empty more than. <3" });
      }
      
    } catch (error) {
      console.log(err);
      
    }
  } else {
    res.redirect("/login");
  }
});

app.get(   // toggle passport google scope
  "/auth/google",
  passport.authenticate("google", {  // toggle passport google OAuth --> passport.use("google",new GoogleStrategy(

    scope: ["profile", "email"],     // need list (just "profile" & "email")

  })
);


////////////////SUBMIT GET ROUTE/////////////////
app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit.ejs");
  } else {
    res.redirect("/login");
  }
});


// when OAuth finish process it will send get to secrets 
// be like "/auth/google --> /secrets"
// so that become to below :

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { // from google OAuth
    successRedirect: "/secrets",
    //failureRedirect: "/login",
    failureRedirect: "/login?registration=success",
  })
);


app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      //console.log(checkResult.rows);
      res.redirect("/login?registration=fail");

    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

////////////////SUBMIT POST ROUTE/////////////////
app.post("/submit", async function (req, res) {
  const submittedSecret = req.body.secret;
  console.log(req.user);
  try {
    await db.query(`UPDATE users SET secret = $1 WHERE email = $2`, [
      submittedSecret,
      req.user.email,  //add secret to database
    ]); 
    res.redirect("/secrets");
  } catch (err) {
    console.log(err);
  }
});



passport.use(
  "google",
  new GoogleStrategy( // passport google OAuth
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      // https://github.com/jaredhanson/passport-google-oauth2/issues/83#issuecomment-1362609483
      // said : remove: userProfileURL :"https://www.googleapis.com/oauth2/v3/userinfo" 
      // from GoogleStrategy. It is no longer needed. Google Auth popup must work now.
      // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, 
async (accessToken, refreshToken, profile, cb) => {
  try {
    console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) { /// has not an email registor
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "login_by_google"] // I will insert password as "login_by_google"
          );
          console.log("this user google ",newUser.rows[0]);

          return cb(null, newUser.rows[0]);
        } else {  /// has an email registor
          return cb(null, result.rows[0]);
        }
    
  } catch (error) {
    return cb(err);    
  }

    }
  )
);



passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        //console.log(user);
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              console.error("Error comparing passwords:", valid);
              return cb("Password incorrect", false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
