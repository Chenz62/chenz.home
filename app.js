var express = require(`express`);
var app = express();
var bluebird = require('bluebird');
var mongoose = require(`mongoose`);
var bodyParser = require(`body-parser`);
var expressSanitizer = require("express-sanitizer");
var methodOverride = require(`method-override`);
var flash = require(`connect-flash`);
var passport = require(`passport`);
var LocalStrategy = require(`passport-local`).Strategy;
// var passportLocalMongoose = require(`passport-local-mongoose`);
var User = require(`./models/user`);
// TODO are these lines required
// var Campground = require(`./models/campground`);
// var Comment = require(`./models/comment`);
// var campgroundRoutes = require(`./routes/campgrounds`);
// var commentRoutes = require(`./routes/comments`);
// var indexRoutes = require(`./routes/auth`);

require('dotenv').load();

// CONNECT mongoose to MongoDB
mongoose.Promise = bluebird;
mongoose.connect(process.env.DB_SERVER_URL, {
	promiseLibrary: bluebird,
	useMongoClient: true
})
.then(function () {
	console.log('Connected to the "Chenz.Online" database!');
})
.catch(function (error) {
	console.error('Error while trying to connect with MongoDB!');
	console.error(error);
});

// SETUP App
app.use(bodyParser.urlencoded({
	extended: true
}));
app.set(`view engine`, `ejs`);
app.use(express.static(__dirname + `/assets`));
app.use(expressSanitizer());
app.use(methodOverride(`_method`));
app.use(flash());
app.locals.moment = require(`moment`);

// PASSPORT Configuration
app.use(require(`express-session`)({
	secret: `Hello cruel world`,
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
	res.locals.currentUser = req.user;
	res.locals.error = req.flash(`error`);
	res.locals.success = req.flash(`success`);
	next();
});

// app.use(`/campgrounds`, campgroundRoutes);
// app.use(`/campgrounds/:id/comments`, commentRoutes);
// app.use(`/`, indexRoutes);

// ROUTES
app.get(`/`, function (req, res) {
	res.render(`index`);
});
// app.get(`/campgrounds`, function (req, res) {
// 	res.render(`campgrounds/list`);
// });

// APP Listener
app.listen(3000, function () {
	console.log(`"Chenz.Online!" has started on PORT:` + process.env.PORT + `!`);
});
