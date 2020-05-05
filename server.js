//https://qrapi0.herokuapp.com/


const express = require('express');
const mysql = require('mysql');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const salt = bcrypt.genSaltSync(10);

const fs = require('fs');


var bodyParser = require('body-parser');
var cors = require('cors');
var methodOverride = require('method-override');
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
db.getConnection(async (err) => {
    console.log('Connecting mySQL....');
    if (err) {
        throw err;
    }
    console.log('mysql connected....');

    var token = await GenerateToken({ ID: 1, Nmae: "dsadsa" });
    console.log(token);
    jwt.verify(token, secretKey, function (err, decoded) {
        console.log(decoded.student.ID);
    })
});

//local test
app.post('/test', cors(corsOptions), async function (request, response) {
    response.send(await GenerateToken({
        AdminNumber:"17",
        UUID:"15"
    }))
});
//web url test
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

app.post('/Login_Password', cors(corsOptions), function (request, response) {

    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var Token = request.body.Token;

    if (AdminNumber != null && InputPassword != null && UUID != null) {
        db.query("Select * From Student Where AdminNumber = ? ;", [AdminNumber], async function (error, result, fields) {
            if (result.length > 0) {
                if (result[0].Password != null && result[0].UUID != null) {
                    var match = bcrypt.compareSync(InputPassword, result[0].Password);

                    if (match) {
                        if (UUID == result[0].UUID) {
                            if (Token == null) { //if user side has no token, on login, will generate a token and return
                                Token = await GenerateToken({
                                    AdminNumber: AdminNumber,
                                    UUID: UUID
                                });
                            }
                            response.send({
                                "ID": 1,
                                "Success": true,
                                "Error_Message": "Authenticated to Login",
                                "Token": Token
                            });
                        }
                        else {
                            response.send({
                                "ID": 2,
                                "Success": false,
                                "Error_Message": "This Account Has Already Registered On Another Device!",
                                "Token": null
                            });
                        }
                    }
                    else {
                        response.send({
                            "ID": 3,
                            "Success": false,
                            "Error_Message": "Wrong Password!",
                            "Token": null
                        });
                    }
                }
                else {
                    response.send({
                        "ID": 4,
                        "Success": false,
                        "Error_Message": "This Account Has Not Registered Yet!",
                        "Token": null
                    });
                }
            }
            else {
                response.send({
                    "ID": 5,
                    "Success": false,
                    "Error_Message": "The Admin Number Does Not Exist",
                    "Token": null
                });
            }
        });
    }
    else {
        response.send({
            "ID": 6,
            "Success": false,
            "Error_Message": "Missing Information",
            "Token": null
        });
    }
});

app.post('/Login_Token', cors(corsOptions), function (request, response) {

    var UUID = request.body.UUID;
    var Token = request.body.Token;
    if (Token != null && UUID != null) {
        jwt.verify(Token, secretKey, function (err, decodedInfo) {
            if (decodedInfo.student.UUID == UUID) {
                db.query("Select * From Student Where AdminNumber = ? AND UUID = ? ", [decodedInfo.student.AdminNumber, UUID], function (err, result) {
                    if (result.length > 0) {
                        response.send({
                            "Authenticated": true
                        });
                    }
                })
            }
        });
    }
    else {
        response.send({
            "Authenticated": false
        });
    }
});

app.post('/Register', cors(corsOptions), async function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var RegisterDate = (moment().tz('Asia/Singapore').format('Do-MMMM-YYYY'));
    var Token = await GenerateToken({
        AdminNumber: AdminNumber,
        UUID: UUID
    });

    response.send({
        Token:Token
    })

    // if (AdminNumber != null && InputPassword != null && UUID != null) {
    //     var HashedPassword = bcrypt.hashSync(InputPassword, salt);
    //     db.query("Update Student Set Password = ?, UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [HashedPassword, UUID, RegisterDate, AdminNumber],
    //         function (err, result, fields) {
    //             if (err) {
    //                 response.send({
    //                     "Success": false,
    //                     "AccountToken": null,
    //                     "Error_Message": "Failed to register!"
    //                 })
    //             }
    //             else {
    //                 if (result.affectedRows > 0) {
    //                     response.send({
    //                         "Success": true,
    //                         "AccountToken": Token,
    //                         "Error_Message": null
    //                     })
    //                 }
    //                 else {
    //                     response.send({
    //                         "Success": false,
    //                         "AccountToken": null,
    //                         "Error_Message": "Failed to register!"
    //                     })
    //                 }
    //             }
    //         })
    // }
});

app.post('/OverwriteDevice', cors(corsOptions), async function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var RegisterDate = (moment().tz('Asia/Singapore').format('Do-MMMM-YYYY'));
    var Token = await GenerateToken({
        AdminNumber: AdminNumber,
        UUID: UUID
    });

    if (AdminNumber != null && UUID != null && InputPassword != null) {
        db.query("Select * From Student Where AdminNumber = ?;", [AdminNumber], function (error, result, fields) {
            if (result.length > 0) {
                var match = bcrypt.compareSync(InputPassword, result[0].Password);
                if (match) {
                    db.query("Update Student Set UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [UUID, RegisterDate, AdminNumber],
                        function (err, result, fields) {
                            if (result.affectedRows > 0) {
                                response.send({
                                    "Success": true,
                                    "AccountToken": Token,
                                    "Error_Message": null
                                })
                            }
                            else {
                                response.send({
                                    "Success": false,
                                    "AccountToken": null,
                                    "Error_Message": "Error Occurs When Updating Account Information!"
                                })
                            }
                        });
                }
                else {
                    response.send({
                        "Success": false,
                        "AccountToken": null,
                        "Error_Message": "Wrong Password!"
                    })
                }
            }
            else {
                response.send({
                    "Success": false,
                    "AccountToken": null,
                    "Error_Message": "Error Getting Student Information With Provided Admin Number"
                });
            }
        })
    }
    else {
        response.send({
            "Success": false,
            "AccountToken": null,
            "Error_Message": "Missing Information!"
        });
    }
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


function GenerateToken(student) {
    return new Promise(resolve => {

        var keyFile = fs.readFileSync('TOKEN_KEY.json');
        var secretKey = JSON.parse(keyFile).Token_Secret_Key;

        if (typeof secretKey !== undefined) {
            jwt.sign({ student: student }, secretKey, { algorithm: 'HS256' }, function (err, token) {
                resolve(token);
            })
        }
    })
}