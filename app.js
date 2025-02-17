const express = require('express');
const app = express();
const session = require('express-session')
const passport = require('./config/passport')
const env = require('dotenv').config()
const db = require('./config/db')
const ejs = require('ejs')
const path = require('path')
const userRouter = require('./routes/userRouter')
const adminRouters = require('./routes/adminRouter')




app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: true, 
    cookie: {
        secure: false,
        httpOnly: true, 
        maxAge: 72 * 60 * 60 * 1000 
    }
}));





app.use(passport.initialize());
app.use(passport.session())





app.use((req,res,next)=>{
    res.set('cache-control',"no-store")
    next()
})


app.set('view engine',"ejs") 
app.set('views', path.join(__dirname, 'views'));
app.use(express.static("public"))





app.use('/',userRouter);
app.use('/admin',adminRouters)


db() 
app.listen(process.env.PORT,()=>{
    console.log('server running http://localhost:3002')
})


module.exports = app;