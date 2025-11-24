import  app  from './app.js';
import mongoose from 'mongoose';

const {connect} = mongoose;


const PORT = process.env.PORT || 3002;

connect(process.env.DATABASE)
.then(() => {
    console.log('Database connected successfully');
})
.catch(err => {
    console.error('Database connection error:', err);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});