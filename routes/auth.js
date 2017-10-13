var express = require(`express`);
var router = express.Router();
var passport = require(`passport`);
var User = require(`../models/user`);
var Campground = require(`../models/campground`);
var async = require(`async`);
var nodemailer = require(`nodemailer`);
var crypto = require(`crypto`);

require(`dotenv`).load();

// SMTP Transporter
var transporter = nodemailer.createTransport({
	host: process.env.SMTP_SERVER,
	port: process.env.SMTP_PORT,
	secure: true,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS
	}
});

// SHOW the landing page
router.get(`/`, function (req, res) {
	res.render(`landing`);
});

// Contact Us - Logic
router.post(`/email`, function (req, res) {
	var mailOptions = {
		from: req.body.email,
		to: process.env.EMAIL_TO,
		subject: `AussieCamp Contact Form`,
		text: req.body.comments
	};
	transporter.sendMail(mailOptions, function (error) {
		if (error) {
			req.flash(`error`, `Failed Sorry! Your email wasn't sent.`);
			return console.log(error);
		}
		req.flash(`success`, `Success! Your email has been sent.`);
		res.redirect(`/campgrounds`);
	});
});

// SIGN UP - Logic
router.post(`/register`, function (req, res) {
	var newUser = new User({
		username: req.body.username,
		firstName: req.body.firstName,
		lastName: req.body.lastName,
		email: req.body.email,
		avatar: req.body.avatar
	});
	if (req.body.adminCode === `secret`) {
		newUser.isAdmin = true;
	}
	User.register(newUser, req.body.password, function (err, user) {
		if (err) {
			req.flash(`error`, `Sorry! We could not sign you up.`);
			console.log(err);
			return res.redirect(`campgrounds`);
		}
		passport.authenticate(`local`)(req, res, function () {
			req.flash(`success`, `Welcome to AussieCamp! ` + user.firstName + `!`);
			res.redirect(`/campgrounds`);
		});
	});
});

// LOGIN - Logic
router.post(`/login`, passport.authenticate(`local`, {
	successRedirect: `back`,
	failureRedirect: `back`,
	failureFlash: true,
	successFlash: `Logged you in!`
}), function (req, res) {});

// LOGOUT - Logic
router.get(`/logout`, function (req, res) {
	req.logout();
	req.flash(`success`, `Logged you out!`)
	res.redirect(`/campgrounds`);
});

// USER - Reset Password
// show Forgot Password form
router.get(`/forgot`, function (req, res) {
	req.flash(`error`, `Error sending email!`)
	res.redirect(`back`);
});

// Forgot Password - LOGIC
router.post(`/forgot`, function (req, res, next) {
	async.waterfall([
		function (done) {
			crypto.randomBytes(20, function (err, buf) {
				var token = buf.toString(`hex`);
				done(err, token);
			});
		},
		function (token, done) {
			User.findOne({
				email: req.body.email
			}, function (err, user) {
				if (!user) {
					req.flash(`error`, `No account with that email address exists.`);
					return res.redirect(`/forgot`);
				}

				user.resetPasswordToken = token;
				user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

				user.save(function (err) {
					done(err, token, user);
				});
			});
		},
		function (token, user, done) {
			var mailOptions = {
				to: user.email,
				from: process.env.SMTP_USER,
				subject: `Password Reset for AussieCamp!`,
				text: `You are receiving this because you have (or someone else has) requested the reset of the password for your account.\n\n` + `Please click on the following link, or paste this into your browser to complete the process:\n\n\t` + `http://` + req.headers.host + `/reset/` + token + `\n\n` + `If you did not request this, please ignore this email and your password will remain unchanged.\n\n` + `Happy Camping...!\n\n`
			};
			transporter.sendMail(mailOptions, function (err) {
				if (err) {
					console.log(err);
				} else {
					req.flash(`success`, `An e-mail has been sent to ` + user.email + ` with further instructions.`);
					done(err, `done`);
				}
			});
		}
	], function (err) {
		if (err) return next(err);
		res.redirect(`/campgrounds`);
	});
});

// GET - Reset Token
router.get(`/reset/:token`, function (req, res) {
	User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: {
			$gt: Date.now()
		}
	}, function (err, user) {
		if (!user) {
			req.flash(`error`, `Password reset token is invalid or has expired.`);
			return res.redirect(`/forgot`);
		}
		res.render(`reset`, {
			token: req.params.token
		});
	});
});

// POST - Reset Token
router.post(`/reset/:token`, function (req, res) {
	async.waterfall([
		function (done) {
			User.findOne({
				resetPasswordToken: req.params.token,
				resetPasswordExpires: {
					$gt: Date.now()
				}
			}, function (err, user) {
				if (!user) {
					req.flash(`error`, `Password reset token is invalid or has expired.`);
					return res.redirect(`back`);
				}
				if (req.body.password === req.body.confirm) {
					user.setPassword(req.body.password, function (err) {
						user.resetPasswordToken = undefined;
						user.resetPasswordExpires = undefined;

						user.save(function (err) {
							req.logIn(user, function (err) {
								done(err, user);
							});
						});
					})
				} else {
					req.flash(`error`, `Passwords do not match.`);
					return res.redirect(`back`);
				}
			});
		},
		function (user, done) {
			var mailOptions = {
				to: user.email,
				from: `aussiecamp@porter-online.com`,
				subject: `Your password has been changed`,
				text: `Hello,\n\n` + `This is a confirmation that the password for your account ` + user.email + ` has just been changed.\n`
			};
			transporter.sendMail(mailOptions, function (err) {
				req.flash(`success`, `Success! Your password has been changed.`);
				done(err);
			});
		}
	], function (err) {
		res.redirect(`/campgrounds`);
	});
});

// USER - Profiles
router.get(`/users/:id`, function (req, res) {
	User.findById(req.params.id, function (err, foundUser) {
		if (err) {
			req.flash(`error`, `Something went wrong!`);
			console.log(err);
			res.redirect(`back`);
		}
		Campground.find().where(`author.id`).equals(foundUser._id).exec(function (err, campgrounds) {
			if (err) {
				req.flash(`error`, `Something went wrong!`);
				console.log(err);
				res.redirect(`back`);
			}
			res.render(`users/show`, {
				user: foundUser,
				campgrounds: campgrounds
			});
		})
	});
});

module.exports = router;
