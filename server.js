//https://qrapi0.herokuapp.com/


const express = require('express');
const mysql = require('mysql');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const salt = bcrypt.genSaltSync(10);

var bodyParser = require('body-parser');
var cors = require('cors');
var methodOverride = require('method-override');
// // Hashing and salting password
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
// Remove cors restriction --important 
app.use(cors());
app.use(bodyParser.json());
app.use(methodOverride());
var moment = require('moment-timezone');


const allowedOrigins = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:8080',
    'http://localhost:8100'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Origin not allowed by CORS'));
        }
    }
}

app.options('*', cors(corsOptions));

app.get('/', cors(corsOptions), (req, res, next) => {
    res.json({ message: 'This route is CORS-enabled for an allowed origin.' });
});


// Update the details if DB's details changed --important
const db = mysql.createPool({
    connectionLimit: 1000,
    host: '182.50.133.78',
    user: 'nypUser',
    password: 'P@ssw0rd!',
    database: 'qrAttend'
});

// Basic things to include
app.set('port', process.env.PORT || 3000);
app.listen(app.get('port'), function () {
    console.log("listening to Port", app.get("port"));
});



// Test for connections
db.getConnection((err) => {
    console.log('Connecting mySQL....');
    if (err) {
        throw err;
    }
    console.log('mysql connected....');
    db.query("Select * From Student Where AdminNumber = ?;", ["173642u"], function (error, result, fields) {
        console.log(result);
    });
});

app.post('/test', cors(corsOptions), function (request, response) {
    db.query("Select * From Student Where AdminNumber = ?;", ["173642u"], function (error, result, fields) {
        response.send(result);
    })
});

// Variables
app.get('/Students', cors(corsOptions), function (request, response) {
    console.log('Connected to /students');
    db.query('select * from Student;', function (err, result, fields) {
        if (err) {
            console.log('Error message: ', err);
            throw err;
        };
        response.send(JSON.parse(JSON.stringify(result)));
    })
});

app.post('/Login', cors(corsOptions), function (request, response) {

    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;

    var msgJson;

    if (AdminNumber != null && InputPassword != null && UUID != null) {

        db.query("Select * From Student Where AdminNumber = ? ;", [AdminNumber], function (error, result, fields) {
                response.send(result);
                if (result.length > 0) {
                    if (result[0].Password != null && result[0].UUID != null) {
                        var match = bcrypt.compareSync(InputPassword, result[0].Password);

                        if (match) {
                            if (UUID == result[0].UUID) {
                                msgJson = {
                                    "ID": 1,
                                    "Status": true,
                                    "Message": "Authenticated to Login"
                                };
                            }
                            else {
                                msgJson = {
                                    "ID": 2,
                                    "Status": false,
                                    "Message": "This Account Has Already Registered On Another Device!"
                                };
                            }
                        }
                        else {
                            msgJson = {
                                "ID": 3,
                                "Status": false,
                                "Message": "Wrong Password!"
                            };
                        }
                    }
                    else {
                        msgJson = {
                            "ID": 4,
                            "Status": false,
                            "Message": "This Account Has Not Registered Yet!"
                        };
                    }
                }
                else {
                    msgJson = {
                        "ID": 5,
                        "Status": false,
                        "Message": "The Admin Number Does Not Exist"
                    };
                }
            
        });
    }
    else {
        msgJson = {
            "ID": 6,
            "Status": false,
            "Message": "Missing Information"
        };
    }

    response.send(msgJson);

});


app.post('/StudentByAdminNum', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    db.query('Select * from Student Where AdminNumber = ?;', [AdminNumber], function (err, result, fields) {
        if (err) {
            console.log('Error message: ', err);
            throw err;
        }
        response.send(JSON.parse(JSON.stringify(result)));
    })
});


app.post('/Register', cors(corsOptions), function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var RegisterDate = (moment().tz('Asia/Singapore').format('Do-MMMM-YYYY'));

    if (AdminNumber != null && InputPassword != null && UUID != null) {
        var HashedPassword = bcrypt.hashSync(InputPassword, salt);
        db.query("Update Student Set Password = ?, UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [HashedPassword, UUID, RegisterDate, AdminNumber],
            function (err, result, fields) {
                if (err) {
                    response.send(err);
                }
                else {
                    response.send(JSON.parse(JSON.stringify(result)));
                }
            })
    }
});

app.post('/OverwriteDevice', cors(corsOptions), function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var RegisterDate = (moment().tz('Asia/Singapore').format('Do-MMMM-YYYY'));

    if (AdminNumber != null && UUID != null && InputPassword != null) {
        db.query("Select * From Student Where AdminNumber = ?;", [AdminNumber], function (error, result, fields) {
            if (result.length > 0) {
                var match = bcrypt.compareSync(InputPassword, result[0].Password);
                if (match) {
                    db.query("Update Student Set UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [UUID, RegisterDate, AdminNumber],
                        function (err, result, fields) {
                            if (!err) {
                                response.send(JSON.parse(JSON.stringify(result)));
                            }
                            else {
                                response.send("Error Occurs When Updating Account Information!");
                            }
                        })
                }
                else {
                    response.send("Wrong Password!");
                }
            }
            else {
                response.send("Error Getting Student Information With Provided Admin Number");
            }
        })
    }
    else {
        response.send("Missing Information!");
    }
});

