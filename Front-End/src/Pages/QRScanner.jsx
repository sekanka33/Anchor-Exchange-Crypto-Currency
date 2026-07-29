import React,{useEffect} from "react";
import {Html5QrcodeScanner} from "html5-qrcode";


const QRScanner=()=>{


useEffect(()=>{


const scanner =
new Html5QrcodeScanner(
"reader",
{
fps:10,
qrbox:250
}
);



scanner.render(

(decodedText)=>{


console.log(
"QR:",
decodedText
);



approveLogin(decodedText);



},

(error)=>{

}

);



return ()=>{

scanner.clear();

};


},[]);



const approveLogin = async(token)=>{


await fetch(
"http://localhost:5000/api/qr/verify",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({

qr_token:token,

userId:"USER_ID_HERE"

})

});


};


return (

<div>

<h1>
Scan Login QR
</h1>


<div id="reader"></div>


</div>

);


};


export default QRScanner;