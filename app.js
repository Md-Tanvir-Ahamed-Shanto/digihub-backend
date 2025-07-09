import express from 'express';


const app = express();
app.use(express.json());

app.use('/', (req,res)=>{
    res.send("Server in Running...")
} );

export default app;
