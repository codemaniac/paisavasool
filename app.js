var express = require('express'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    mongodb = require('mongodb'),
    mongoose = require('mongoose'),
    bcrypt = require('bcrypt'),
    winston = require('winston'),
    SALT_WORK_FACTOR = 10;

var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename: 'master.log' })
    ]
  });
logger.exitOnError = false;

mongoose.connect('localhost', 'test9');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    logger.log('info','Connected to DB');
});

// User Schema
var userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    totalrevenue: {
        type: Number,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    role: {
        type: String,
        required: true
    },
});

var custSchema = mongoose.Schema({
    custid: {
        type: String,
        required: true,
        unique: true
    },
    pin: {
        type: Number,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
});


// Bcrypt middleware
userSchema.pre('save', function(next) {
    var user = this;

    if (!user.isModified('password')) return next();

    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });
});

// Password verification
userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

var User = mongoose.model('User', userSchema);
var Customer = mongoose.model('Customer', custSchema);
var user = new User({
    username: 'admin',
    password: 'secret',
    totalrevenue: 0,
    balance: 0,
    role: 'admin'
});
user.save(function(err) {
    if (err) {
	logger.log('warn','Could not save seed user! Might already be saved earlier');
    } else {
	logger.log('info', 'user: ' + user.username + ' saved');
    }
});

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new LocalStrategy(function(username, password, done) {
    User.findOne({
        username: username
    }, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false, {
                message: 'Unknown user ' + username
            });
        }
        user.comparePassword(password, function(err, isMatch) {
            if (err) return done(err);
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, {
                    message: 'Invalid password'
                });
            }
        });
    });
}));

var app = express();

// configure Express
app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.engine('ejs', require('ejs-locals'));
    app.use(express.logger());
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.session({
        secret: 'keyboard cat'
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.static(process.cwd() + '/static'));
});


app.get('/', function(req, res) {
    res.redirect('/login');
});

app.get('/admin', function(req, res) {
    res.render('admin');
});

app.get('/login', function(req, res) {
    res.render('login', {
        user: req.user,
        message: req.session.messages
    });
});

app.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) {
            return next(err)
        }
        if (!user) {
            req.session.messages = [info.message];
            return res.redirect('/login')
        }
	if (user.role != 'venture') {
		return res.redirect('/')
	}
        req.logIn(user, function(err) {
            if (err) {
                return next(err);
            }
            return res.redirect('/venture');
        });
    })(req, res, next);
});

app.post('/adminlogin', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) {
            return next(err)
        }
        if (!user) {
            req.session.messages = [info.message];
            return res.redirect('/admin')
        }
	if (user.role != 'admin'){
	    res.redirect('/');
	}
        req.logIn(user, function(err) {
            if (err) {
                return next(err);
            }
            return res.redirect('/adminhome');
        });
    })(req, res, next);
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/leaderboard', function(req, res) {
    var q = User.find({'role': {'$ne': 'admin'}}).sort({
        'balance': 'descending'
    }).limit(10);
    q.exec(function(err, users) {
        res.render('leaderboard', {
            users: users
        });
    });
});

app.get('/adminhome', ensureAuthenticated, function(req, res) {
    res.render('adminhome', {
        user: req.user
    });
});

app.get('/venture', ensureAuthenticated, function(req, res) {
    res.render('venture', {
        user: req.user
    });
});

app.get('/ventures', ensureAuthenticated, function(req, res) {
    User.find({'role': {'$ne': 'admin'}}, function(err, ventures) {
        res.send(ventures);
    });
});

app.post('/venture/create', ensureAuthenticated, function(req, res) {
    User.findOne({
        username: req.body.name
    }, function(err, user) {
        if (err) {
	    logger.log('warn', 'Error while searching for venture!');
            res.send({
                'success': false,
                'message' : 'Error while searching for venture!'
            });
        }
        if (!user) {
	    logger.log('info', 'Creating new venture '+req.body.name);
            var newuser = new User({
                username: req.body.name,
                password: req.body.pwd,
                totalrevenue: -(parseFloat(req.body.amount)),
                balance: -(parseFloat(req.body.amount)),
                role: 'venture'
            });
            newuser.save(function(err) {
                if (err) {
		    logger.log('warn', 'Error while saving venture - ' + req.body.name);
                    res.send({
                        'success': false,
                        'message': 'Error while saving venture'
                    });
                } else {
                    logger.log('info', 'New venture created - ' + req.body.name);
                    res.send({
                        'success': true
                    });
                }
            });
        } else {
	    logger.log('warn', 'Venture already exists - ' + req.body.name);
            res.send({
                'success': false,
                'message': 'Venture already exists!'
            });
        }
    });
});

app.post('/venture/withdraw', ensureAuthenticated, function(req, res) {
    User.findOne({
        username: req.body.name
    }, function(err, user) {
        if (err) {
	    logger.log('warn', 'Error while withdrawing - ' + req.body.name);
            res.send({
                'success': false,
                'message': 'Error while withdrawing!'
            });
        }
        if (!user) {
            logger.log('warn', 'Error while withdrawing! No such venture exists - ' + req.body.name);
            res.send({
                'success': false,
                'message': 'No such venture exists!'
            });
        } else {
            user.balance -= parseFloat(req.body.amount);
            user.save(function(err) {
                if (err) {
                    logger.log('warn', 'Error while withdrawing! Error while saving - ' + req.body.name);
                    res.send({
                        'success': false,
                        'message': 'Error while saving!'
                    });
                } else {
		    logger.log('info', user.username + " balance deducted by " + req.body.amount);
                    res.send({
                        'success': true
                    });
                }
            });
        }
    });
});

app.post('/venture/sale', ensureAuthenticated, function(req, res) {
    User.findOne({
        username: req.user.username
    }, function(err, user) {
        if (err) {
	    logger.log('warn', 'Error while sale! Error while searching for venture - ' + req.user.username);
            res.send({
                'success': false,
                'message': 'Error while sale! Error while searching for venture!'
            });
        }
        if (!user) {
            logger.log('warn', 'Error while sale! No such venture exists - ' + req.user.username);
            res.send({
                'success': false,
                'message': 'No such venture exists!'
            });
        } else {
            Customer.findOne({
                custid: req.body.custid
            }, function(err, cust) {
                if (err) {
		    logger.log('warn', 'Error while finding customer for sale - ' + req.body.custid);
                    res.send({
                        'success': false,
                        'message': 'Error while finding customer for sale!'
                    });
                }
                if (!cust) {
		    logger.log('warn', 'Trying to make sale for non-existant customer - ' + req.body.custid);
                    res.send({
                        'success': false,
                        'message': 'No such customer exists!'
                    });
                } else {
                    if (cust.pin == req.body.pin) {
			if (cust.balance < req.body.amount) {
				logger.log('warn', 'Insufficient balance - ' + req.body.custid);
                                res.send({
                                    'success': false,
                                    'message': 'Insufficient balance!'
                                });
			} else {
                        	cust.balance -= parseFloat(req.body.amount);
	                        cust.save(function(err) {
        	                    if (err) {
					logger.log('warn', 'Error while deducting balance from customer - ' + req.body.custid);
                        	        res.send({
                                	    'success': false,
	                                    'message': 'Error while deducting balance from customer!'
        	                        });
                	            } else {
                        	        user.balance = user.balance + parseFloat(req.body.amount);
					user.save(function(err) {
                				if (err) {
							logger.log('warn', 'Error while saving balance to venture');
							cust.balance += parseFloat(req.body.amount);
							cust.save();
                	    				res.send({
                        					'success': false,
                                	                        'message': 'Error while saving balance to venture!'
                    					});
	                			} else {
							logger.log('info', req.body.custid + ' --[' + req.body.amount + ']--> ' + req.user.username);
                	    				res.send({
                        					'success': true
                    					});
                				}
	            			});
        	                    }
                	        });
			}
                    } else {
			logger.log('warn', 'Error while sale ! Invalid PIN');
                        res.send({
                            'success': false,
                            'message': 'Invalid PIN!'
                        });
                    }
                }
            });

        }
    });
});

app.get('/customer/balance', ensureAuthenticated, function(req, res) {
Customer.findOne({
        custid: req.query.custid
    }, function(err, cust) {
        if (err) {
	    logger.log('warn', 'Error while searching for customer - ' + req.body.custid);
            res.send({
                'success': false,
                'message': 'Error while searching for customer!'
            });
        }
        if (!cust) {
	    logger.log('warn', 'Trying to get balance for non-existant customer - ' + req.body.custid);
                    res.send({
                        'success': false,
                        'message': 'No such customer exists!'
                    });            
        } else {
            if (cust.pin == req.query.pin) {
                res.send({
                        'success': true,
                        'balance': cust.balance
                    });                
            } else {
		logger.log('warn', 'Entered invalid PIN while recharging!');
                res.send({
                    'success': false,
                    'message': 'Invalid PIN!'
                });
            }
        }
    });
});

app.post('/customer/recharge', ensureAuthenticated, function(req, res) {
    Customer.findOne({
        custid: req.body.custid
    }, function(err, cust) {
        if (err) {
	    logger.log('warn', 'Error while searching for customer - ' + req.body.custid);
            res.send({
                'success': false,
                'message': 'Error while searching for customer!'
            });
        }
        if (!cust) {
	    logger.log('info', 'Creating new customer - ' + req.body.custid);
            var newCust = new Customer({
                custid: req.body.custid,
                pin: req.body.pin,
                balance: parseFloat(req.body.amount)
            });
            newCust.save(function(err) {
                if (err) {
        	    logger.log('warn', 'Error while saving customer - ' + req.body.custid);
                    res.send({
                        'success': false,
                        'message':'Error while saving customer!'
                    });
                } else {
                    logger.log('info', 'customer: ' + req.body.custid + " saved");
                    res.send({
                        'success': true
                    });
                }
            });

        } else {
            if (cust.pin == req.body.pin) {
                cust.balance += parseFloat(req.body.amount);
                cust.save(function(err) {
                    if (err) {
			logger.log('warn', 'Error while saving customer during recharge - ' + req.body.custid);
                        res.send({
                            'success': false,
                            'message': 'Error while saving customer during recharge!'
                        });
                    } else {
                        res.send({
                            'success': true
                        });
                    }
                });
            } else {
		logger.log('warn', 'Entered invalid PIN while recharging!');
                res.send({
                    'success': false,
                    'message': 'Invalid PIN!'
                });
            }
        }
    });
});

app.listen(8080, function() {
    console.log('Express server listening on port 8080');
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login')
}