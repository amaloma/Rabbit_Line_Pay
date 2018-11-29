/** =================================================================================== *
 *        ______   ______   ______     ______   ______     ______     __  __            *
 *       /\  == \ /\  == \ /\  ___\   /\__  _\ /\  ___\   /\  ___\   /\ \_\ \           *
 *       \ \  _-/ \ \  _-/ \ \  __\   \/_/\ \/ \ \  __\   \ \ \____  \ \  __ \          *
 *        \ \_\    \ \_\    \ \_____\    \ \_\  \ \_____\  \ \_____\  \ \_\ \_\         *
 *         \/_/     \/_/     \/_____/     \/_/   \/_____/   \/_____/   \/_/\/_/         *
 *                                                                                      *
 * ==================================================================================== *
 *  By: Panya Aewsiri                                                                   *
 *  Email: aew.panya@gmail.com                                                          *
 *  Date: 29/11/2018                                                                    *
 * ==================================================================================== *
 *                                                                                      *
 *  VTI Protocal                                                                        *
 *  >   Start of Text   (1)                                                             *
 *  >   Length of Message data (2)                                                      *
 *  >   Message data                                                                    *
 *  >   >   Transpot [header type(2), destination(4), source(4)]                        *
 *  >   >   Presentation [format vertion(1), Request-Response(1), Transaction Code(2),  *
 *  >   >       Response Code(2), More Indicator(1), Field Separator(1)]                *
 *  >   >   Field data [type(2), llll(2), data, separator(1)]                           *
 *  >   End of Text (1)                                                                 *
 *  >   LRC xor (1)                                                                     *
 *                                                                                      *
 ** =================================================================================== */

var SerialPort = require('serialport');
var bst = require('buffer-split');
var port = new SerialPort("com1", {
    baudRate: 9600,
    autoOpen: false
});
var _buffer = new Buffer.from([]);
var responseData = {};
var tick = 0;
const Timeout = 15;

const ACK = Buffer.from([0x06]);
const ACK_ERR = Buffer.from([0x15]);
const STX = Buffer.from([0x02]);
const ETX = Buffer.from([0x03]);

const Transport = {
    Header: Buffer.from("60"),
    Destination: Buffer.from("0000"),
    Source: Buffer.from("0000")
}

const Presentation = {
    Format_Version: Buffer.from("1"),
    Request_Response: Buffer.from("0"),
    Response_Code: Buffer.from("00"),
    More_Indicator: Buffer.from("0"),
    Field_Separator: Buffer.from([0x1C]),
    TransactionCode: {
        Rabbit_Top_Up: Buffer.from("24"),
        Sale_Rabbit: Buffer.from("57"),
        Sale_Rabbit_Amount: Buffer.from("40"),
        Rabbit_Check_Balance: Buffer.from("58"),
        Null_Type: Buffer.from("00"),
        New_Rabbit_Refund: Buffer.from("60"),
        Card_Number: Buffer.from("30"),
        Rabbit_Inquiry_Last_Transection_Log: Buffer.from("62")
    }
}

const FieldType = {
    Null_Type: Buffer.from("00"),
    Approval_Code: Buffer.from("01"),
    Response_Text: Buffer.from("02"),
    Transaction_Date: Buffer.from("03"),
    Transaction_Time: Buffer.from("04"),
    Transaction_Date_Time: Buffer.from("05"),
    Merchant_Number: Buffer.from("06"),
    Terminal_ID: Buffer.from("16"),
    Primary_Account_Number: Buffer.from("30"),
    Expired_Date: Buffer.from("31"),
    Amount_Transaction: Buffer.from("40"),
    Amount_Tip: Buffer.from("41"),
    Amount_Cash_Back: Buffer.from("42"),
    Amount_Tax: Buffer.from("43"),
    Amount_Balance: Buffer.from("44"),
    Amount_Balance_Negative: Buffer.from("45"),
    Batch_Number: Buffer.from("50"),
    Trace_Invoice_Number: Buffer.from("65"),
    Merchant_Name_And_Address: Buffer.from("D0"),
    Merchant_ID: Buffer.from("D1"),
    Card_Issuer_Name: Buffer.from("D2"),
    Reference_Number: Buffer.from("D3"),
    Card_Issuer_ID: Buffer.from("D4"),
    LINE_Pay_Transaction_ID: Buffer.from("DC"),
    Batch_Total_Sales_Count: Buffer.from("H1"),
    Batch_Total_Sales_Amount: Buffer.from("H2"),
    Nll: Buffer.from("HN"),
    Rabbit_Reader_ID: Buffer.from("R1"),
    Rabbit_Trace: Buffer.from("R2"),
    Rabbit_Transaction_Type: Buffer.from("R3"),
    Rabbit_Last_Transaction_Code: Buffer.from("R4"),
    Field_Separator: Buffer.from([0x1C]),
}

const ResponseCode = {
    Cancel_by_User_Operation: Buffer.from("NULL"),
    Approve: Buffer.from("00"),
    Reject_from_Rabbit: Buffer.from("RB"),
    Reject_from_Host: Buffer.from("XX"),
}

const ErrorCode = {
    RABBIT_TRACE_INVALID_OR_NOT_LAST: Buffer.from("01"),
    RABBIT_NO_CARD_DETECTED: Buffer.from("02"),
    RABBIT_ALREADY_REFUND: Buffer.from("03"),
    RABBIT_TRACE_NOT_REFUND: Buffer.from("04"),
    RABBIT_NOT_CONNECTED: Buffer.from("05"),
    RABBIT_NOT_LOGON: Buffer.from("06"),
    RABBIT_NOT_FOUND: Buffer.from("07"),
    RABBIT_BLOCK_ALL: Buffer.from("08"),
    RABBIT_BLOCK_ADD_ATU: Buffer.from("09"),
    RABBIT_BLOCK_ADD: Buffer.from("10"),
    RABBIT_INSUFFICIENT_REMAINING_VALUE: Buffer.from("11"),
    RABBIT_LAST_USAGE_EXPIRED: Buffer.from("12"),
    RABBIT_CARD_EXPIRED: Buffer.from("13"),
    RABBIT_CSC_BLOCKED: Buffer.from("14"),
}

CMD_CheckBalance = async() => {
    let cmd_data = Buffer.concat([
        Transport.Header,
        Transport.Destination,
        Transport.Source,
        Presentation.Format_Version,
        Presentation.Request_Response,
        Presentation.TransactionCode.Rabbit_Check_Balance,
        Presentation.Response_Code,
        Presentation.More_Indicator,
        Presentation.Field_Separator,
        FieldType.Null_Type,
        Buffer.from("00"),
        FieldType.Field_Separator
    ])

    let bf = Buffer.concat([
        Buffer.from(["0", parseInt(cmd_data.byteLength, 16)]),
        cmd_data,
        ETX
    ])
    let lrc = await LRC(bf);
    let rtn = Buffer.concat([STX, bf, lrc]);
    return rtn;
}

CMD_Sale = async(amount) => {
    let am = ""; 
    if(amount.indexOf(".") >= 0){
        am = await FormatNumberLength(amount.replace(".",""), 12);
    }else{
        am = await FormatNumberLength(amount + "00", 12);
    }  

    let cmd_data = Buffer.concat([
        Transport.Header,
        Transport.Destination,
        Transport.Source,
        Presentation.Format_Version,
        Presentation.Request_Response,
        Presentation.TransactionCode.Sale_Rabbit,
        Presentation.Response_Code,
        Presentation.More_Indicator,
        Presentation.Field_Separator,
        FieldType.Amount_Transaction,
        Buffer.from([0x00, 0x12]),
        Buffer.from(am),
        FieldType.Field_Separator, 
    ])

    let bf = Buffer.concat([
        Buffer.from(["0", parseInt(cmd_data.byteLength, 16)]),
        cmd_data,
        ETX
    ])

    let lrc = await LRC(bf);
    let rtn = Buffer.concat([STX, bf, lrc]);
    return rtn;
}

CMD_TopUp = async(amount) => {
    let am = ""; 
    if(amount.indexOf(".") >= 0){
        am = await FormatNumberLength(amount.replace(".",""), 12);
    }else{
        am = await FormatNumberLength(amount + "00", 12);
    }  

    let cmd_data = Buffer.concat([
        Transport.Header,
        Transport.Destination,
        Transport.Source,
        Presentation.Format_Version,
        Presentation.Request_Response,
        Presentation.TransactionCode.Rabbit_Top_Up,
        Presentation.Response_Code,
        Presentation.More_Indicator,
        Presentation.Field_Separator,
        FieldType.Amount_Transaction,
        Buffer.from([0x00, 0x12]),
        Buffer.from(am),
        FieldType.Field_Separator, 
    ])

    let bf = Buffer.concat([
        Buffer.from(["0", parseInt(cmd_data.byteLength, 16)]),
        cmd_data,
        ETX
    ])

    let lrc = await LRC(bf);
    let rtn = Buffer.concat([STX, bf, lrc]);
    return rtn;
}

LRC = (cmd) => {
    var xor = 0x00;
    for(let i = 0; i < cmd.byteLength; i++){
        xor = xor ^ cmd[i];
    }
    return Buffer.from([xor]);
}

FormatNumberLength = (num, length) => {
    var r = "" + num;
    while (r.length < length) {
        r = "0" + r;
    }
    return r;
}

SendCMD = (cmd) => {
    port.write(cmd,function(err){
        if(err) throw err;
        return true;
    });
}

CheckSum_CMD = async (cmd, callback) => {
    let ck_sum = cmd.slice(cmd.byteLength-1, cmd.byteLength);
    cmd = cmd.slice(1, cmd.byteLength-1);
    let cal_ck_sum = await LRC(cmd);
    if(ck_sum.toString('hex') == cal_ck_sum.toString('hex')){
        callback(true);
    }else{
        callback(false);
    }
}

DecodePackage = (message, callback) => {
    let rtn = {};
    let r_cmd = Buffer.from([message[15], message[16]]);
    let res_code = '';
    let fieldArr = [];

    switch(r_cmd.toString('hex')){
        case Presentation.TransactionCode.Rabbit_Top_Up.toString('hex'):
            rtn.Action = "Topup";
        break;
        case Presentation.TransactionCode.Sale_Rabbit.toString('hex'):
            rtn.Action = "Sale";
        break;
        case Presentation.TransactionCode.Rabbit_Check_Balance.toString('hex'):
            rtn.Action = "Check Balance";
        break;
    }

    res_code = Buffer.from([message[17], message[18]]);
    switch(res_code.toString()){
        case ResponseCode.Approve.toString():
            rtn.Status = "Approve"; 
        break;
        case ResponseCode.Cancel_by_User_Operation.toString():
            rtn.Status = "Cancel by User Operation";
        break;
        case ResponseCode.Reject_from_Host.toString():
            rtn.Status = "Reject from Host";
        break;
        case ResponseCode.Reject_from_Rabbit.toString():
            rtn.Status = "Reject from Rabbit"
        break;
    }
    
    fieldArr = bst(message, FieldType.Field_Separator);
    if(fieldArr.length > 0) fieldArr = fieldArr.slice(1, fieldArr.length-1);
    fieldArr.forEach(async (field) => {
        rtn = await DecodeFieldData(field, rtn);
    })

    callback(rtn);
}

DecodeFieldData = (field, obj) => {
    let type = field.slice(0, 2);
    let len = parseInt(field.slice(2,3).toString('hex') + field.slice(3,4).toString('hex'));
    let data = field.slice(4);
    let temp = "";
    switch(type.toString('hex')){
        case FieldType.Amount_Balance.toString('hex'):
        temp = data.toString();
        temp = temp.slice(0, temp.length -2) + '.' + temp.slice(temp.length -2);
        obj.Amount_Balance = temp;
        break;
        case FieldType.Amount_Balance_Negative.toString('hex'):
        obj.Amount_Balance_Negative = data.toString();
        break;
        case FieldType.Amount_Cash_Back.toString('hex'):
        obj.Amount_Cash_Back = data.toString();
        break;
        case FieldType.Amount_Tax.toString('hex'): 
        obj.Amount_Tax = data.toString();
        break;
        case FieldType.Amount_Tip.toString('hex'):
        obj.Amount_Tip = data.toString();
        break;
        case FieldType.Amount_Transaction.toString('hex'):
        obj.Amount_Transaction = data.toString();
        break;
        case FieldType.Approval_Code.toString('hex'):
        obj.Approval_Code = data.toString();
        break;
        case FieldType.Batch_Number.toString('hex'):
        obj.Batch_Number = data.toString();
        break;
        case FieldType.Batch_Total_Sales_Amount.toString('hex'):
        obj.Batch_Total_Sales_Amount = data.toString();
        break;
        case FieldType.Batch_Total_Sales_Count.toString('hex'):
        obj.Batch_Total_Sales_Count = data.toString();
        break;
        case FieldType.Card_Issuer_ID.toString('hex'):
        obj.Card_Issuer_ID = data.toString();
        break;
        case FieldType.Card_Issuer_Name.toString('hex'):
        obj.Card_Issuer_Name = data.toString();
        break;
        case FieldType.Expired_Date.toString('hex'):
        obj.Expired_Date = data.toString();
        break;
        case FieldType.LINE_Pay_Transaction_ID.toString('hex'):
        obj.LINE_Pay_Transaction_ID = data.toString();
        break;
        case FieldType.Merchant_ID.toString('hex'):
        obj.Merchant_ID = data.toString();
        break;
        case FieldType.Merchant_Name_And_Address.toString('hex'):
        obj.Merchant_Name_And_Address = data.toString();
        break;
        case FieldType.Merchant_Number.toString('hex'):
        obj.Merchant_Number = data.toString();
        break;
        case FieldType.Nll.toString('hex'):
        obj.Nll = data.toString();
        break;
        case FieldType.Null_Type.toString('hex'):
        obj.Null_Type = data.toString();
        break;
        case FieldType.Primary_Account_Number.toString('hex'):
        obj.Primary_Account_Number = data.toString();
        break;
        case FieldType.Rabbit_Last_Transaction_Code.toString('hex'):
        obj.Rabbit_Last_Transaction_Code = data.toString();
        break;
        case FieldType.Rabbit_Reader_ID.toString('hex'):
        obj.Rabbit_Reader_ID = data.toString();
        break;
        case FieldType.Rabbit_Trace.toString('hex'):
        obj.Rabbit_Trace = data.toString();
        break;
        case FieldType.Rabbit_Transaction_Type.toString('hex'):
        obj.Rabbit_Transaction_Type = data.toString();
        break;
        case FieldType.Reference_Number.toString('hex'):
        obj.Reference_Number = data.toString();
        break;
        case FieldType.Response_Text.toString('hex'):
        obj.Response_Text = data.toString();
        break;
        case FieldType.Terminal_ID.toString('hex'):
        obj.Terminal_ID = data.toString();
        break;
        case FieldType.Trace_Invoice_Number.toString('hex'):
        obj.Trace_Invoice_Number = data.toString();
        break;
        case FieldType.Transaction_Date.toString('hex'):
        obj.Transaction_Date = data.toString();
        break;
        case FieldType.Transaction_Date_Time.toString('hex'):
        obj.Transaction_Date_Time = data.toString();
        break;
        case FieldType.Transaction_Time.toString('hex'):
        obj.Transaction_Time = data.toString();
        break;
    }

    return obj;
}

ProcessData = (data) => {
    //console.log('Data:', data);
    if(data.byteLength == 1){
        switch(data.toString('hex')){
            case ACK.toString('hex'):
                //console.log('Reader acknowledges receipt of the message');
            break;
            case ACK_ERR.toString('hex'):
                //console.log('Reader receives a message in error');
                responseData.Action = "Send Command";
                responseData.Status = "Reader receives a message in error";
            break;
        } 
    }else{
        if(data.slice(0,1).toString('hex') == STX.toString('hex')){
            _buffer = data;
        }else{
            _buffer = Buffer.concat([_buffer, data]);
        }
        
        CheckSum_CMD(_buffer,(isCMD) => {
            if(isCMD){
                //Decode Package
                DecodePackage(_buffer, (result)=>{
                    responseData = result;
                });
            }
        });
    }
};

module.exports = {
    getPorts: () => {
        return new Promise((resolve, reject) => {
            SerialPort.list((err, results)=>{
                if(err) throw err;
                resolve(results);
            })
        })
    },
    connect: (portname, callback) =>{
        var rtn = {
            "Action": "Connect Serialport",
        }
        port = new SerialPort(portname, {
            baudRate: 9600,
            autoOpen: true
        }, (err) => {
            if(err){
                rtn.Message = err.message;
            }else{
                port.on('data', ProcessData);
            }
            rtn.Status = port.isOpen;
            if(callback){
                callback(rtn);
            }
        })
        
    },
    CheckBalance: async(callback) =>{
        let cmd = await CMD_CheckBalance();
        SendCMD(cmd);
        responseData = {};
        let checkResponse = setInterval(()=>{
            if(responseData.hasOwnProperty('Action') || (tick >= Timeout)){
                tick = 0;
                clearInterval(checkResponse);
                callback(responseData);
            }else{
                tick += 1;
            }
        }, 1000);
    }, 
    Sale: async(amount, callback) => {
        let cmd = await CMD_Sale(amount);
        SendCMD(cmd);
        responseData = {};
        let checkResponse = setInterval(()=>{
            if(responseData.hasOwnProperty('Action') || (tick >= Timeout)){
                tick = 0;
                clearInterval(checkResponse);
                callback(responseData);
            }else{
                tick += 1;
            }
        }, 1000);
    },
    TopUp: async(amount, callback) => {
        let cmd = await CMD_TopUp(amount);
        SendCMD(cmd);
        responseData = {};
        let checkResponse = setInterval(()=>{
            if(responseData.hasOwnProperty('Action') || (tick >= Timeout)){
                tick = 0;
                clearInterval(checkResponse);
                callback(responseData);
            }else{
                tick += 1;
            }
        }, 1000);
    }
}