const express = require('express')
const cors = require('cors')
const { Keypair } = require('@solana/web3.js')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('JAR backend running')
})

app.post('/jar/create', (req, res) => {
  const keypair = Keypair.generate()

  res.json({
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey) // тимчасово
  })
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
