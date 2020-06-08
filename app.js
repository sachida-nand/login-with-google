require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.set("view engine","ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

const saltRounds = 10;//rounding a password

mongoose.connect("mongodb://localhost:27017/securitydb",{ useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex",true);
const userSchema = new mongoose.Schema({
  emil:String,
  password: String,
  googleId:String,
  secret:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err,user);
    });
  }
));


app.get("/", function(req,res){
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect:"/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/login", function(req,res){
  res.render("login");
});

app.get("/logout", function(req,res){
  req.logout();
  res.redirect("/");
});

app.get("/register", function(req,res){
  res.render("register");
});

app.get("/submit", function(req,res){
  res.render("submit");
});

app.get("/secrets",function(req,res){
  User.find({"secret":{$ne:null}}, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        res.render("secrets", {secretsMassage: foundUser})
      }
    }
  })
});

app.get("/submit", function(req,res){
  if(req.isAuthenticated()){
    res.render("secrets");
  }else{
    res.redirect("/login");
  }
});

app.post("/submit", function(req,res){
  const submitedSecrets = req.body.secret;


  User.findById(req.user.id, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      foundUser.secret = submitedSecrets;
      foundUser.save(function() {
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/register", function(req,res){
    User.register({username: req.body.username}, req.body.password, function(err,user){
      if(err){
        console.log(err);
        res.redirect("/register");
      }else{
        passport.authenticate("local")(req,res, function(){
          res.redirect("/secrets");
        });
      }
    });
});

app.post("/login", function(req,res){
     const user = new User({
       username:req.body.username,
       password:req.body.password
     });

     req.login(user, function(err){
       if(err){
         console.log(err);
       }else{
         passport.authenticate("local")(req,res, function(){
           res.redirect("/secrets");
         });
       }
     });
});






app.listen(3000, function(){
  console.log("server started at port 3000");
});
