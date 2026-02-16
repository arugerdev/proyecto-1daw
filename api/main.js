// CARGAR .env PARA VARIABLES PRIVADAS DE CONEXION
require('dotenv').config();

const cors = require('cors')

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const express = require('express')
const mysql = require('mysql2')

const app = express()

app.use(express.json(), cors({ origin: '*' }));


const port = 3000

// CARGAR VARIABLES .env
const host = process.env.HOST;
const user = process.env.USER;
const password = process.env.PASSWORD;
const database = process.env.DATABASE;
const secret = process.env.SECRET_KEY;

// CREAR CONEXION
const connection = mysql.createConnection({
    host, user, password, database
})

app.get('/api/', (req, res) => {
    res.send('Hola desde la api!')

    connectDB();

    SELECT('*', 'USUARIOS').then(([rows, fields]) => {
        console.log(rows)
    })

    /*
        DELETE('USUARIOS', 'TRUE').then(([rows, fields]) => {
            console.log(rows)
        })
    
        SELECT('*', 'USUARIOS').then(([rows, fields]) => {
            console.log(rows)
        })
    */




    endConnectionDB();
})

app.post('/api/login', (req, res) => {
    const data = req.body;

    SELECT('*', 'USUARIOS', `WHERE nombre = "${data.username}"`).then(([rows, fields]) => {
        if (rows.length > 0) {
            bcrypt.compare(data.password, rows[0].contraseña).then((res) => {
                console.log(res)

            })
        }
    })

    res.end()
})

app.listen(port, () => {
    console.log(`App listening by ${port} port`)
})


function connectDB() {
    connection.connect()
    // DEVUELVE TRUE SI CONECTA
    SELECT('1 + 1 AS solution', '', '').then(([rows, fields]) => {
        console.log('The solution is: ', rows[0].solution)
    })
}

function SELECT(params, table, extra = "") {
    return connection.promise().query(`SELECT ${params} ${table && table != '' ? `FROM ${table}` : ''} ${extra}`)
}

function INSERT(table, names = [], values = [], extra = "") {
    let QUERY = "INSERT INTO "
    QUERY += table + " (";
    names.forEach((el, index) => {
        QUERY += el

        if (index >= names.length - 1) {
            return
        }

        QUERY += ","
    })

    QUERY += " ) VALUES ( "

    values.forEach((el, index) => {
        QUERY += el

        if (index >= names.length - 1) {
            return
        }

        QUERY += ","
    })

    QUERY += " ) " + extra

    return connection.promise().query(QUERY)
}

function DELETE(table, condition) {
    return connection.promise().query(`DELETE FROM ${table} WHERE ${condition}`)
}

// TERMINAR CONEXION
function endConnectionDB() {
    if (connection.state == "connected") connection.end();
}

// ESTO NO SERIA NECESARIO, LA QUERY SQL DEBERIA CREAR LA CUENTA AUTOMATICAMENTE
// #############################################################################
function insertarAdminPorDefecto() {
    bcrypt.hash('admin', 12, (err, hash) => {
        INSERT('USUARIOS', ['nombre', 'contraseña'], ['"admin"', `"${hash}"`]).then(([rows, fields]) => {
            console.log(rows)
        })
    });
}
// #############################################################################