const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.static('public'))

var options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
};

mongoose.connect(process.env.DB_URI, options);

const Schema = mongoose.Schema;
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  log: Array
})

const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create new user
app.post("/api/exercise/new-user", async function (req, res) {
  const username = req.body.username.trim();
  if (username.includes(' ')) {
    res.status(400).json({ error: "Empty spaces between not aloud" })
  } else {
    const isUsernameExists = await User.exists({ username: username });
    if (isUsernameExists) {
      res.status(400).json({ error: "Username already exists" })
    } else {
      const user = new User({ username: username, log: [] });
      const newUser = await user.save();
      res.json(newUser)
    }
  }
})

// Get all users
app.get("/api/exercise/users", async (req, res) => {
  const users = await User.find({}, 'username _id');
  res.json(users)
})

// Add new exercise
app.post("/api/exercise/add", async (req, res) => {
  let { userId, description, duration, date } = req.body;
  const exercise = {
    date: date ? new Date(date).toDateString() : new Date().toDateString(),
    duration: +duration,
    description
  };
  await User.findById(userId, (err, user) => {
    if (err) res.status(400).json({ error: `User with ID ${userId} no found` })
    User.findByIdAndUpdate(userId, { log: [...user.log, exercise] }, (err, updUser) => {
      if (err) res.status(400).json({ error: err })
      res.json({ _id: updUser._id, username: updUser.username, ...exercise })
    })
  });
})

// Response with userdata incl. log and count of exercises
app.get("/api/exercise/log/", (req, res) => {
  const { userId, limit } = req.query
  let { from, to } = req.query
  if (from) from = new Date(from).toDateString()
  if (to) to = new Date(to).toDateString()
  User.findById(userId, (err, user) => {
    if (err) res.status(400).json({ error: `User with ID ${userId} no found` })
    let log = user.log
    log = from ? log.filter(exercise => Date.parse(exercise.date) >= new Date(from)) : log
    log = to ? log.filter(exercise => Date.parse(exercise.date) < new Date(to)) : log
    log = limit ? log.slice(-Number(limit)) : log
    const resObj = { _id: user._id, username: user.username, from, to, count: log.length, log }
    res.json(resObj)
  })
})


// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
