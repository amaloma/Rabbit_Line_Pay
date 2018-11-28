
const readline = require('readline');
const rabbit = require('./lib/vti-protocal');

var log = console.log;
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var recursiveAsyncReadLine = ()=>{
    rl.question('1: Check Balance \n2: Topup \n3: Sale\nCommand >> ', (answer) => {
        switch(answer){
            case "1":
                rabbit.CheckBalance((res)=>{
                    console.log(res);
                    recursiveAsyncReadLine();
                });
            break;
            case "2":
                rl.question('Topup Amount : ', (amount) => {
                    rabbit.TopUp(amount, (res)=>{
                        console.log(res);
                        recursiveAsyncReadLine();
                    });
                })
            break;
            case "3":
                rl.question('Sale Amount : ', (amount) => {
                    rabbit.Sale(amount, (res)=>{
                        console.log(res);
                        recursiveAsyncReadLine();
                    });
                })
            break;
            default:
                recursiveAsyncReadLine();
            break;
        }
    });
};

rl.question('set serialport : ', (answer) => {
    log("connect port : " + answer);
    rabbit.connect(answer, (res) => {
        if(res.Status){
            recursiveAsyncReadLine(); 
        }else{
            process.exit();
        }
    })
})
