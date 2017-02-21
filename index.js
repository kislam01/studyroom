//index.js/
var express = require('express'),
    exphbs = require('express-handlebars'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    validator = require('validator'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    TwitterStrategy = require('passport-twitter'),
    GoogleStrategy = require('passport-google'),
    FacebookStrategy = require('passport-facebook');

//We will be creating these two files shortly
 var config = require('./config.js'), //config file contains all tokens and other private info
    funct = require('./functions.js'); //funct file contains our helper functions for our Passport and database work

var app = express();


//===============PASSPORT===============

//This section will contain our work with Passport

// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login/"signin" users.
passport.use('local-signin', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.username);
        req.session.success = 'You are successfully logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));
// Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    firstname = req.body.firstname;
    lastname = req.body.lastname;
    funct.localReg(username, password, firstname, lastname)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.username);
        req.session.success = 'You are successfully registered and logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));    

//===============EXPRESS================
// Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//Database initialization
var entries_mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/studyroom';
var entries_MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = entries_MongoClient.connect(entries_mongoUri, function(error, databaseConnection) {
    db = databaseConnection;
});


// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});

// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main', //we will be creating this layout shortly
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/views'));

app.engine('html', require('ejs').renderFile);

//===============ROUTES===============

//This section will hold our Routes

app.post('/sendData', function(request, response) {
    var student_name = request.user.firstname + " " + request.user.lastname;
    var course = request.body.course; 
    var problem = request.body.problem;
    var student_location = request.body.student_location;
    var user_id = request.user.username;
    var toInsert = {
        "user_id": user_id,
        "student_name": student_name,
        "course": course,
        "problem": problem,
        "student_location": student_location,
    };
    db.collection('student_entries', function(error, coll) {
        var id = coll.insert(toInsert, function(error, saved) {
            if (error) {
                response.sendStatus(500);
            }else {
                coll.find().toArray(function(err, entry_array) {
                    response.send(entry_array);
                });
            }
        });
    });
});

app.get('/getEntries', function(request, response) {
    response.set('Content-Type','application/json');
    db.collection('student_entries', function(err, collection) {
        if (err) {
            response.send(500);
        } else {
            collection.find().toArray(function(er, cursor) {
            response.send(cursor);
            }); 
        }

    });

});


//displays our homepage
app.get('/', function(req, res){
  res.render('home', {user: req.user});
});

//displays our signup page
app.get('/signin', function(req, res){
  res.render('signin');
});



app.get('/mainpage', function(req, res, next){
  if (req.isAuthenticated()) {return next(); }
  req.session.error = 'Please sign in!';
  res.redirect('/signin');
  
},
  function(req, res){
  res.render('main_page.html');
  }
);

app.get('/createlisting',function(req, res, next){
  if (req.isAuthenticated()) {return next(); }
  req.session.error = 'Please sign in!';
  res.redirect('/signin');
},
  function(req, res){
  res.render('create_listing.html');
  }
);

//sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/local-reg', passport.authenticate('local-signup', {
  successRedirect: '/mainpage',
  failureRedirect: '/signin'
  })
);

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', {
  successRedirect: '/mainpage',
  failureRedirect: '/signin'
  })
);

//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
  var name = req.user.username;
  console.log("LOGGIN OUT " + req.user.username)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});

//===============PORT=================
var port = process.env.PORT || 5000; //select your port or let it pull from your .env file
app.listen(port);
console.log("listening on " + port + "!");