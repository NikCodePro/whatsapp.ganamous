// 1. Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// 2. Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Configure Middleware
app.set('view engine', 'ejs'); // Set EJS as the templating engine
app.use(bodyParser.urlencoded({ extended: true })); // To parse form data
app.use(express.static('public')); // To serve static files (if any)

// 4. Connect to MongoDB
// Make sure you have MongoDB running on your local machine
// Replace 'whatsapp-redirect-db' with your desired database name
mongoose.connect('mongodb+srv://techneural:XB1ajIgz32TAK8Uw@techneural.rcfn1ld.mongodb.net/ganamous', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Successfully connected to MongoDB!');
}).catch(err => {
  console.error('Connection error', err);
  process.exit();
});

// 5. Define a Mongoose Schema and Model
const numberSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PhoneNumber = mongoose.model('PhoneNumber', numberSchema);

// 6. Define Routes

// GET Route for the home page
app.get('/', (req, res) => {
  // Renders the index.ejs file from the 'views' folder
  res.render('index');
});

// POST Route to handle form submission
app.post('/save-number', async (req, res) => {
  try {
    // Extract phone number from the request body
    // It's good practice to include the country code without '+'
    const rawNumber = req.body.phoneNumber;

    // Basic validation to remove non-numeric characters
    const cleanNumber = rawNumber.replace(/\D/g, '');

    if (!cleanNumber) {
        return res.status(400).send("Invalid phone number provided.");
    }
    
    // Create a new document using the PhoneNumber model
    const newNumber = new PhoneNumber({
      phoneNumber: cleanNumber
    });

    // Save the document to the database
    const savedNumber = await newNumber.save();
    console.log('Number saved:', savedNumber);

    // Redirect to the success page, passing the saved number as a query parameter
    res.redirect(`/success?phone=${savedNumber.phoneNumber}`);

  } catch (error) {
    console.error('Error saving number:', error);
    // You might want to render an error page here
    res.status(500).send('An error occurred while saving the number.');
  }
});

// GET Route for the success page
app.get('/success', (req, res) => {
  const phoneNumber = req.query.phone;
  if (!phoneNumber) {
    // If no phone number is provided in the query, redirect to home
    return res.redirect('/');
  }
  // Render the success.ejs page and pass the phone number to it
  res.render('success', { phoneNumber: phoneNumber });
});


// 7. Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
