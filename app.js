var express = require('express'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    mongodb = require('mongodb'),
    mongoose = require('mongoose'),
    bcrypt = require('bcrypt'),
    SALT_WORK_FACTOR = 10;

mongoose.connect('localhost', 'test3');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    console.log('Connected to DB');
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
    username: 'bob',
    password: 'secret',
    totalrevenue: 0,
    balance: 0
});
user.save(function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('user: ' + user.username + " saved.");
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
    var q = User.find().sort({
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
    User.find({}, function(err, ventures) {
        res.send(ventures);
    });
});

app.post('/venture/create', ensureAuthenticated, function(req, res) {
    User.findOne({
        username: req.body.name
    }, function(err, user) {
        if (err) {
            console.log("Error !");
            res.send({
                'success': false
            });
        }
        if (!user) {
            console.log("creating new user");
            var newuser = new User({
                username: req.body.name,
                password: req.body.pwd,
                totalrevenue: -(req.body.amount),
                balance: -(req.body.amount)
            });
            newuser.save(function(err) {
                if (err) {
                    console.log(err);
                    res.send({
                        'success': false
                    });
                } else {
                    console.log('user: ' + req.body.name + " saved.");
                    res.send({
                        'success': true
                    });
                }
            });
        } else {
            console.log("User already exists");
            res.send({
                'success': false
            });
        }
    });
});

app.post('/venture/withdraw', ensureAuthenticated, function(req, res) {
    User.findOne({
        username: req.body.name
    }, function(err, user) {
        if (err) {
            console.log("Error !");
            res.send({
                'success': false
            });
        }
        if (!user) {
            res.send({
                'success': false
            });
        } else {
            user.balance -= parseFloat(req.body.amount);
            console.log(user.username + " balance deducted by " + req.body.amount);
            user.save(function(err) {
                if (err) {
                    res.send({
                        'success': false
                    });
                } else {
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
            console.log("Error !");
            res.send({
                'success': false
            });
        }
        if (!user) {
            res.send({
                'success': false
            });
        } else {
            Customer.findOne({
                custid: req.body.custid
            }, function(err, cust) {
                if (err) {
                    console.log("Error !");
                    res.send({
                        'success': false
                    });
                }
                if (!cust) {
                    console.log("Error !");
                    res.send({
                        'success': false
                    });
                } else {
                    if (cust.pin == req.body.pin) {
                        cust.balance -= parseFloat(req.body.amount);
                        cust.save(function(err) {
                            if (err) {
                                res.send({
                                    'success': false
                                });
                            } else {
                                user.balance = user.balance + parseFloat(req.body.amount);
				user.save(function(err) {
                			if (err) {
                    				res.send({
                        				'success': false
                    				});
                			} else {
						console.log(req.body.custid + ' --[' + req.body.amount + ']--> ' + req.user.username);
                    				res.send({
                        				'success': true
                    				});
                			}
            			});
                            }
                        });
                    } else {
                        res.send({
                            'success': false
                        });
                    }
                }
            });

        }
    });
});

app.post('/customer/recharge', ensureAuthenticated, function(req, res) {
    Customer.findOne({
        custid: req.body.custid
    }, function(err, cust) {
        if (err) {
            console.log("Error !");
            res.send({
                'success': false
            });
        }
        if (!cust) {
            var newCust = new Customer({
                custid: req.body.custid,
                pin: req.body.pin,
                balance: req.body.amount
            });
            newCust.save(function(err) {
                if (err) {
                    console.log(err);
                    res.send({
                        'success': false
                    });
                } else {
                    console.log('customer: ' + req.body.custid + " saved.");
                    res.send({
                        'success': true
                    });
                }
            });

        } else {
            if (cust.pin == req.body.pin) {
                cust.balance += req.body.amount;
                cust.save(function(err) {
                    if (err) {
                        res.send({
                            'success': false
                        });
                    } else {
                        res.send({
                            'success': true
                        });
                    }
                });
            } else {
                res.send({
                    'success': false
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