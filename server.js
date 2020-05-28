//https://qrapi0.herokuapp.com/


const express = require('express');
const mysql = require('mysql');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const salt = bcrypt.genSaltSync(10);

const fs = require('fs');

var secretKey = "QRAttendanceAPIv0";

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
    var AdminNumber = '173642u';

    var CurrentDate = (moment().tz('Asia/Singapore').format('YYYY-MM-D'));
    var CurrentTime = (moment().tz('Asia/Singapore').format('HH:mm:ss'));

    var query  = 'Select Distinct l.* From Lesson l ' +
    'Inner Join Schedule sh On l.LessonID = sh.LessonID '+
    'Inner Join Student st On st.AdminNumber = sh.AdminNumber '+
    'Where LessonDate = ? '+
    "And AddTime(LessonTime, Concat(Convert(LessonDuration, char),':0:0')) >= Convert(?, Time) "+
    'And st.AdminNumber = ? ' +
    'Order By l.LessonTime asc';

    var parameter=[CurrentDate, CurrentTime, AdminNumber];

    db.query(query, parameter, function (err, result, fields) {
        console.log(result);
    })
});

//web url test, this method is nvr used.
app.get('/TestConnection', cors(corsOptions), function (request, response) {
    db.query('select AdminNumber from Student;', function (err, result, fields) {
        if (err) {
            response.send({
                "Success":success,
                "Message":err
            })
        }
        else if(result.length>0){
            response.send({
                "Success":true,
                "Message":"API Working. Database Working. Data Gotten"
            })
        }
        else{
            response.send({
                "Success":true,
                "Message":"API Working. Database Working. But No Data"
            })
        }
    })
});

//get a student's information by his adminNumber.
app.post('/StudentByAdminNum', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    try {
        db.query('Select * from Student Where AdminNumber = ?;', [AdminNumber], function (err, result, fields) {
            if (err) {
                response.send({
                    "StudentInfo": null,
                    "Error_Message": err.sqlMessage
                });
            }
            response.send({
                "StudentInfo": result,
                "Error_Message": null
            });
        })
    }
    catch (error) {
        response.send({
            "StudentInfo": null,
            "Error_Message": error
        })
    }

});

//check if student's mobile UUID has already been registered by other device.
app.post('/UUIDAvailability', cors(corsOptions), function (request, response) {
    var UUID = request.body.UUID;
    db.query('Select * from Student Where UUID = ?;', [UUID], function (err, result, fields) {
        if (err) {
            response.send({
                "StudentInfo":null,
                "Error_Message":err.sqlMessage
            })
        }
            response.send({
                "StudentInfo":result,
                "Error_Message":null
            })
    })
});

//Called when login through admin number and password. Authenticate if credentials are correct
app.post('/Login_Password', cors(corsOptions), function (request, response) {

    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var Token = request.body.Token;

    if (AdminNumber != null && InputPassword != null && UUID != null) {
        db.query("Select * From Student Where AdminNumber = ? ;", [AdminNumber], async function (error, result, fields) {
            if (result.length > 0) {
                if (result[0].Password != null && result[0].UUID != null) {

                if (UUID == result[0].UUID) {
                        var match = bcrypt.compareSync(InputPassword, result[0].Password);

                        if (match) {
                            if (Token == null) { //if student side has no token, on login, will generate a token and return
                                Token = await GenerateToken({
                                    AdminNumber: AdminNumber,
                                    UUID: UUID
                                });
                            }
                            response.send({
                                "ID": 1,
                                "Success": true,
                                "Error_Message": "Authenticated to Login",
                                "AccountToken": Token
                            });
                        }
                        else {
                            response.send({
                                "ID": 3,
                                "Success": false,
                                "Error_Message": "Wrong Password!",
                                "AccountToken": null
                            });
                        }
                }
                else {
                    response.send({
                        "ID": 2,
                        "Success": false,
                        "Error_Message": "This Account Has Already Registered On Another Device!",
                        "AccountToken": null
                    });
                }
            }
            else {
                response.send({
                    "ID": 4,
                    "Success": false,
                    "Error_Message": "This Account Has Not Registered Yet!",
                    "AccountToken": null
                });
            }

            }
            else {
                response.send({
                    "ID": 5,
                    "Success": false,
                    "Error_Message": "The Admin Number Does Not Exist",
                    "AccountToken": null
                });
            }
        });
    }
    else {
        response.send({
            "ID": 6,
            "Success": false,
            "Error_Message": "Missing Information",
            "AccountToken": null
        });
    }
});

//Called when login through Token. It is a automatically login function and operates when app if launch.
app.post('/Login_Token', cors(corsOptions), function (request, response) {

    var UUID = request.body.UUID;
    var Token = request.body.Token;
    if (Token != null && UUID != null) {
        jwt.verify(Token, secretKey, function (err, decodedInfo) {
            if (decodedInfo.student.UUID == UUID) {
                db.query("Select * From Student Where AdminNumber = ? AND UUID = ? ", [decodedInfo.student.AdminNumber, UUID], function (err, result) {
                    if (result.length > 0) {
                        response.send({
                            "Authenticated": true,
                            "AdminNumber": result[0].AdminNumber
                        });
                    }
                    else {
                        response.send({
                            "Authenticated": false,
                            "AdminNumber": null
                        });
                    }
                })
            }
            else {
                response.send({
                    "Authenticated": false,
                    "AdminNumber": null
                });
            }
        });
    }
    else {
        response.send({
            "Authenticated": false,
            "AdminNumber": null
        });
    }
});

//Called when student wants to register account
app.post('/Register', cors(corsOptions), async function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var CurrentDate = (moment().tz('Asia/Singapore').format('D-MM-YYYY'));
    var Token = await GenerateToken({
        AdminNumber: AdminNumber,
        UUID: UUID
    });

    if (AdminNumber != null && InputPassword != null && UUID != null) {
        var HashedPassword = bcrypt.hashSync(InputPassword, salt);
        db.query("Update Student Set Password = ?, UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [HashedPassword, UUID, CurrentDate, AdminNumber],
            function (err, result, fields) {
                if (err) {
                    response.send({
                        "Success": false,
                        "AccountToken": null,
                        "Error_Message": "Failed to register!"
                    })
                }
                else {
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
                            "Error_Message": "Failed to register!"
                        })
                    }
                }
            })
    }
});

//Called when student requires a verification code, which is updated in database in this api.  (send to their email in other api)
app.put('/UpdateVerification', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    var VerificationCode = request.body.VerificationCode;
    var CurrentDateTime = (moment().tz('Asia/Singapore').format('YYYY-MM-D HH:mm:ss'));

    var query = 'Update Student Set VerificationCode = ? , VerificationDateTime = ? Where AdminNumber = ?';
    var parameter = [VerificationCode, CurrentDateTime, AdminNumber];
    try {
        db.query(query, parameter, function (err, result, fields) {
            if (err) {
                response.send({
                    "Success": false,
                    "Error_Message": err.sqlMessage
                });
            }
            else if (result.affectedRows > 0) {
                response.send({
                    "Success": true,
                    "Error_Message": null
                });
            }
            else {
                response.send({
                    "Success": false,
                    "Error_Message": "Updating Failed!"
                });
            }
        })
    }
    catch (error) {
        response.send({
            "Success": false,
            "Error_Message": "Unexpected Error Occur!"
        });
    }
});

//Called when need to verify if they verification code is correct and not expired
app.post('/ValidateVerification', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    var VerificationCode = request.body.VerificationCode;
    var CurrentDateTime = (moment().tz('Asia/Singapore').format('YYYY-MM-D HH:mm:ss'));
    var query = 'Select * from Student Where AdminNumber = ? AND VerificationCode = ? AND Date_Add(VerificationDateTime, INTERVAL 10 MINUTE) >= ?;';
    var parameter = [AdminNumber, VerificationCode, CurrentDateTime];

    try {
        db.query(query, parameter, function (err, result, fields) {
            if (err) {
                response.send({
                    "Success":false,
                    "Error_Message": err.sqlMessage
                });
            }
            else if(result.length>0){
                response.send({
                    "Success":true,
                    "Error_Message": null
                });
            }
            else{
                response.send({
                    "Success":false,
                    "Error_Message": "The Verification Code is Invalid or Has Expired!"
                });
            }

        })
    }
    catch (error) {
        response.send({
            "Success":false,
            "Error_Message": error
        })
    }
});

//Called when student wants to change password
app.put('/UpdatePassword', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    var Password = request.body.Password;
    var HashedPassword = bcrypt.hashSync(Password, salt);

    var query = 'Update Student Set Password = ? Where AdminNumber = ?;';
    var parameter = [HashedPassword, AdminNumber];
    
    try {
        db.query(query, parameter , function (err, result, fields) {
            if (err) {
                response.send({
                    "Success": false,
                    "Error_Message": err.sqlMessage
                });
            }
            else if (result.affectedRows > 0) {
                response.send({
                    "Success": true,
                    "Error_Message": null
                });
            }
            else {
                response.send({
                    "Success": false,
                    "Error_Message": "Updating Failed!"
                });
            }
        })
    }
    catch (error) {
        response.send({
            "Success": false,
            "Error_Message": "Unexpected Error Occur!"
        });
    }
});

//Called when student changes device - UUID
app.post('/OverwriteDevice', cors(corsOptions), async function (request, response) {
    // Values from JSON in register.page.ts
    var AdminNumber = request.body.AdminNumber;
    var InputPassword = request.body.InputPassword;
    var UUID = request.body.UUID;
    var CurrentDate = (moment().tz('Asia/Singapore').format('D-MM-YYYY'));
    var Token = await GenerateToken({
        AdminNumber: AdminNumber,
        UUID: UUID
    });

    if (AdminNumber != null && UUID != null && InputPassword != null) {
        db.query("Select * From Student Where AdminNumber = ?;", [AdminNumber], function (error, result, fields) {
            if (result.length > 0) {
                var match = bcrypt.compareSync(InputPassword, result[0].Password);
                if (match) {
                    db.query("Update Student Set UUID = ?, LastRegisterDate = ? Where AdminNumber = ?;", [UUID, CurrentDate, AdminNumber],
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

//Called when student use QRScanner to take attendance for a lesson
app.put('/TakeAttendance', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    var LessonQRText = request.body.LessonQRText;
    var ValidDateTime = (moment().tz('Asia/Singapore').format('YYYY-MM-D HH:mm:ss'));
    var UpdateClockType;
    var query = 'Select sh.ScheduleID, sh.AttendanceStatus, l.LessonType, sh.AttendanceStatus, sh.ClockInTime from Schedule sh ' +
        'Inner Join Lesson l On sh.LessonID = l.LessonID ' +
        'Inner Join Student st On sh.AdminNumber = st.AdminNumber ' +
        'Where st.AdminNumber = ? And l.LessonQRText = ? AND ' +
        '((l.LessonType != "FYPJ" And l.QRValidUntil <= ?) OR ' +
        '(l.LessonType = "FYPJ" And DATE_FORMAT(l.QRValidUntil, "%Y-%m-%d") = DATE_FORMAT(?, "%Y-%m-%d") )) ;';
    var parameter = [AdminNumber, LessonQRText, ValidDateTime, ValidDateTime];
    try {

        db.query(query, parameter, function (err, result, fields) {
            if (result.length > 0) {
                if (result[0].LessonType != 'FYPJ' && result[0].AttendanceStatus == 1 && result[0].ClockInTime != null) {
                    response.send({
                        "Success": false,
                        "Error_Message": "Attendance Already Taken!"
                    })
                }
                else if (result[0].LessonType == 'FYPJ' && result[0].AttendanceStatus == 1 && result[0].ClockInTime != null) {
                    UpdateClockType = "ClockOut";
                }
                else {
                    UpdateClockType = 'ClockIn';
                }

                var ClockedTime = (moment().tz('Asia/Singapore').format('HH:mm'));
                var ScheduleID = result[0].ScheduleID;
                var updateQuery;

                if (UpdateClockType == 'ClockIn') {
                    updateQuery = 'Update Schedule Set AttendanceStatus = 1, ClockInTime = ? Where ScheduleID = ? ;'
                }
                else if (UpdateClockType == 'ClockOut') {
                    updateQuery = 'Update Schedule Set AttendanceStatus = 1, ClockOutTime = ? Where ScheduleID = ? ;'
                }

                db.query(updateQuery, [ClockedTime, ScheduleID], function (error, result, fields) {
                    if (result.affectedRows > 0) {
                        response.send({
                            "Success": true,
                            "Error_Message": null
                        })
                    }
                    else {
                        response.send({
                            "Success": false,
                            "Error_Message": "Updating Failed!"
                        })
                    }
                })
            }
            else {
                response.send({
                    "Success": false,
                    "Error_Message": "The QR Code Is Invalid Or Has Expired!"
                })
            }
        })

    }
    catch (error) {
        response.send({
            "Success": false,
            "Error_Message": "Unexpected Error Occur!"
        })
    }
});

//Called to show all the lessons that student has attended for that semester or yet to attend on that day
//Shows only lessons on that day and before.
app.post('/LessonAttendanceByStudent', cors(corsOptions), function (request, response) {
    var AdminNumber = request.body.AdminNumber;
    var CurrentDate = (moment().tz('Asia/Singapore').format('D-MM-YYYY'));

    var query = 'Select m.ModuleCode, m.ModuleName, l.LessonID, l.LessonDate, l.LessonTime, l.LessonVenue, l.LessonType, s.ScheduleID, s.AttendanceStatus, s.ClockInTime, s.ClockOutTime ' +
        'From Module m ' +
        'Inner Join Lesson l ' +
        'On m.ModuleCode = l.ModuleCode ' +
        'Inner Join Schedule s ' +
        'On l.LessonID = s.LessonID ' +
        'Where s.AdminNumber = ? AND DATE_FORMAT(l.LessonDate, "%d-%m-%Y") <= ?' +
        'Order By l.LessonDate desc, l.LessonTime desc';

    try {
        db.query(query, [AdminNumber, CurrentDate], function (error, result, fields) {
            if (error) {
                response.send({
                    "Success": false,
                    "LessonResults": null,
                    "Error_Message": error.sqlMessage
                })
            }
            else if (result.length > 0) {
                response.send({
                    "Success": true,
                    "LessonResults": result,
                    "Error_Message": null
                })
            }
            else if (result.length <= 0) {
                response.send({
                    "Success": false,
                    "LessonResults": result,
                    "Error_Message": "Failed To Get Any Records!"
                })
            }

        })
    }
    catch (error) {
        response.send({
            "Success": false,
            "LessonResults": null,
            "Error_Message": "Unexpected Error Occur!"
        })
    }
});

//Gets all the lessons for the day that the student has yet to attend.
app.post('/LessonForTheDay',cors(corsOptions),function(request,response){

    var AdminNumber = request.body.AdminNumber;

    var CurrentDate = (moment().tz('Asia/Singapore').format('YYYY-MM-D'));
    var CurrentTime = (moment().tz('Asia/Singapore').format('HH:mm:ss'));

    var query  = 'Select Distinct l.*, m.ModuleName From Lesson l ' +
    'Inner Join Schedule sh On l.LessonID = sh.LessonID '+
    'Inner Join Student st On st.AdminNumber = sh.AdminNumber '+
    'Inner Join Module m On l.ModuleCode = m.ModuleCode ' +
    'Where LessonDate = ? '+
    "And AddTime(LessonTime, Concat(Convert(LessonDuration, char),':0:0')) >= Convert(?, Time) "+
    'And st.AdminNumber = ? ' +
    'Order By l.LessonTime;';

    var parameter=[CurrentDate, CurrentTime, AdminNumber];

    db.query(query, parameter, function (err, result, fields) {
        if (err) {
            response.send({
                "Success":false,
                "Lesson_Results":null,
                "Error_Message":err.sqlMessage
            })
        }
        else if(result.length>0){
            response.send({
                "Success":true,
                "Lesson_Results":result,
                "Error_Message":null
            })
        }
        else{
            response.send({
                "Success":false,
                "Lesson_Results":null,
                "Error_Message":null

            })
        }
    })
})

//Gets the location settings info to see if using location feature to take attendance is enabled, and get all the coordinates.
app.get('/LocationSettings', cors(corsOptions), function (request, response) {
    db.query('Select * From Location_Function_Setting;', function (err, result, fields) {
        if (err) {
            response.send({
                "Success":false,
                "Setting_Results":null
            })
        }
        else if(result.length>0){
            response.send({
                "Success":true,
                "Setting_Results":result[0]
            })
        }
        else{
            response.send({
                "Success":false,
                "Setting_Results":null
            })
        }
    })
});

//Gets the settings info on the total number of times allowed for a student to register account on new devices per sem
app.get('/ChangeDeviceSettings', cors(corsOptions), function (request, response) {
    response.send({
        "Success":true,
        "Setting_Results":{ChangeDeviceEnabled: false, NumberOfTimes:3}
    });
});





function GenerateToken(student) {
    return new Promise(resolve => {

        //var keyFile = fs.readFileSync('./TOKEN_KEY.json');
        //var secretKey = JSON.parse(keyFile).Token_Secret_Key;

        if (typeof secretKey !== undefined) {
            jwt.sign({ student: student }, secretKey, { algorithm: 'HS256' }, function (err, token) {
                resolve(token);
            })
        }
    })
}