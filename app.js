//jshint esversion:6
require('dotenv').config()
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const { Schema } = mongoose;
// const encrypt = require('mongoose-encryption');
// const md5 = require('md5');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

const localDBAddress = "mongodb://localhost:27017/userDB";

const atlasDBAddress = `mongodb+srv://${process.env.ATLAS_DB_USER}:${process.env.ATLAS_DB_PASSWORD}@cluster0.m2h9a.mongodb.net/todolistDB?retryWrites=true&w=majority`;

mongoose.connect(atlasDBAddress, { useCreateIndex : true, useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false })
//mongoose.connect(localDBAddress, { useCreateIndex : true, useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false })
                .then((mongoose) => console.log("Connected with the database server"))
                .catch((err) => console.log("Failed to connect with the database server:", err));

const userSchema = new Schema(
    {
        email: String,
        password: String,
        googleId: String,
    }
);

const secretSchema = new Schema(
    {
        secretText: String,
    }
);

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Commented out this part after testing 'mongoose-encryption' module:
// const secret = process.env.SECRET;
// userSchema.plugin(encrypt, { secret: secret, excludeFromEncryption: ['email'] });

const User = new mongoose.model("User", userSchema);
const Secret = new mongoose.model("Secret", secretSchema);

passport.use(User.createStrategy());
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
  },
  function(accessToken, refreshToken, profile, done) {
       User.findOrCreate({ googleId: profile.id }, function (err, user) {
         return done(err, user);
       });
  }
));

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
passport.serializeUser(function(user, done) {
    done(null, user.id);
  }
);
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  }
);

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] })
);

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  }
);

app.get('/submit', (req, res) =>
    {
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
        
        if (req.isAuthenticated())
        {
            res.render('submit')
        }
        else
        {
            res.redirect('/login');
        }
    }
);

app.get('/secrets', (req, res) =>
    {
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
        
        Secret
          .find()
          .then((foundSecrets) => { res.render("secrets", { secrets: foundSecrets }) })
          .catch(err => console.log(`There appeared an errror during searching secrets:\n${err}`));
        
    }
);

app.post('/submit', (req, res) =>
    {
        const secretText = req.body.secret;
        new Secret({ secretText: secretText })
            .save()
            .then(() => { console.log("Successfully saved the new secret"); res.redirect('/secrets') })
            .catch(err => console.log(`Failed to save the new secret:\n${err}`));
    }
);

app.post("/register", async (req, res) => {
    
    User.register({ username: req.body.username }, req.body.password , function(err, user) {
    if (err) 
    { 
        console.log(err);
        res.redirect('/register');
    }
    else
    {
        // let authenticate = User.authenticate();
        // authenticate(req.body.username, req.body.password, function(err, result) {
        // if (err) 
        // { 
        //     console.log("There appeared an error during authentication of the user: " + req.body.username);
        // }
        // else if(result)
        // {
        //     console.log("Successfully authenticated the user: " + req.body.username);
        // }
        // else 
        // {
        //     console.log("Failed to authenticate the user: " + req.body.username);
        // }

        passport.authenticate('local')(req, res, function () {
            console.log("Successfully authenticated the user: " + req.body.username);  
            res.redirect('/secrets');
        });
    }
});
    
    // Eventually, commenting out also the part using bcrypt and the inital body of the function

    // let password;
    // await bcrypt
    //   .hash(req.body.password, saltRounds)
    //   .then(function(hash) {
    //     password = hash;
    //   })
    //   .catch(err => console.log(`There appeared an error during the attempt of hashing a password:\n${err}`));
    
    // const newUser = new User({
    //     email: req.body.username,
    //     // commented md5 out
    //     // password: md5(req.body.password),
    //     password: password,
    // });

    // newUser
    //   .save()
    //   .then(() => 
    //   { 
    //     console.log(`New user was successfully added:\n${newUser}`); 
    //     res.render("secrets");
    //   })
    //   .catch((err) =>
    //   {
    //     console.log(`Failed to add a new user:\n${err}`);
    //   });
});

app.post("/login", 
    passport.authenticate('local', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/secrets');
    //});

// (req, res) => {
    
    // Commenting out the body of the function used earlier. Now implementing passport and othe dependencies
    
    // const username = req.body.username;
    // const password =  req.body.password;

    // User
    //   .findOne({ email: username })
    //   .then((foundUser) => 
    //   { 
    //     if (foundUser)
    //     {
    //         console.log(`The user with the given username was found`); 
    //         // Tested md5 out. Now move to bcrypt so md5 part will be commented out
    //         // if (foundUser.password === md5(password))
    //         bcrypt
    //         .compare(password, foundUser.password)
    //         .then(function(result) {
    //             if (result)
    //             {
    //                 console.log("The typed password is valid. You can see the secrets page.");
    //                 res.render("secrets");
    //             }
    //             else
    //             { 
    //                 console.log("The password was invalid");
    //                 res.redirect("/");
    //             }
    //         })
    //         .catch(err => console.log(`There appeared an error during comparing passwords:\n${err}`));
    //     }
    //   })
    //   .catch(err => console.log("There appeared an error during login attempt:\n" + err));
});

app.listen(3000, () => console.log("Server started on port 3000"));
