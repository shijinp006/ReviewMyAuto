import DeviceSession from "../models/deviceSchema.js"
import jwt from "jsonwebtoken"

export const splashCheck = async (req,res)=>{

 try{

 const accessToken = req.cookies?.accessToken
 const refreshToken = req.cookies?.refreshToken
 const deviceId = req.cookies?.deviceId

 // 1️⃣ Access token check
 if(accessToken){
  try{

   const decoded = jwt.verify(accessToken,process.env.JWT_ACCESS_SECRET)

   return res.json({
    success:true,
    loggedIn:true,
    userId:decoded.id
   })

  }catch(err){
   // expired → continue
  }
 }

 // 2️⃣ Refresh token check
 if(refreshToken){
  try{

   const decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET)

   const newAccess = jwt.sign(
    {id:decoded.id},
    process.env.JWT_ACCESS_SECRET,
    {expiresIn:"15m"}
   )

   res.cookie("accessToken",newAccess,{
    httpOnly:true,
    sameSite:"strict"
   })

   return res.json({
    success:true,
    loggedIn:true
   })

  }catch(err){
   // refresh expired → continue
  }
 }

 // 3️⃣ Device session recovery
 if(deviceId){

  const session = await DeviceSession.findOne({deviceId})

  if(session && session.expiresAt > new Date()){

   const accessToken = jwt.sign(
    {id:session.userId},
    process.env.JWT_ACCESS_SECRET,
    {expiresIn:"30d"}
   )

   const refreshToken = jwt.sign(
    {id:session.userId},
    process.env.JWT_REFRESH_SECRET,
    {expiresIn:"30d"}
   )

   res.cookie("accessToken",accessToken,{
    httpOnly:true,
    sameSite:"strict"
   })

   res.cookie("refreshToken",refreshToken,{
    httpOnly:true,
    sameSite:"strict"
   })

   return res.json({
    success:true,
    loggedIn:true
   })

  }

 }

 // 4️⃣ No valid login
 return res.json({
  success:true,
  loggedIn:false
 })

 }catch(error){

 res.status(500).json({
  success:false,
  message:"Splash check failed"
 })

 }

}