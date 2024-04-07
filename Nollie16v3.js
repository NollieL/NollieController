export function Name() { return "Nollie16v3"; } 
export function VendorId() { return 0x3061; }
export function ProductId() { return 0x4716; }
export function Publisher() { return "Nollie"; } 
export function Size() { return [0, 0]; }
export function DefaultPosition(){return [120, 80];}
export function DefaultScale(){return 8.0;}
export function Type() { return "Hid"; }
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
HLE:readonly
*/
export function ControllableParameters() 
{
	return [
		{"property":"shutdownColor", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"000000"},
		{"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"009bde"},
		{"property":"HLE", "group":"lighting", "label":"Hardware effect", "type":"combobox", "values":["Static", "Nollie"], "default":"Static"}];
}

export function SubdeviceController() { return true; }

const ChannelLed = 256;
const MaxLedsInPacket = 256;
const DeviceMaxLedLimit = ChannelLed * 16;
let SendData = [];
let ChLedNum = new Array(32).fill(0);

let ChannelArray = 
[
	["Channel 01", ChannelLed],
	["Channel 02", ChannelLed],
	["Channel 03", ChannelLed],
	["Channel 04", ChannelLed],
	["Channel 05", ChannelLed],
	["Channel 06", ChannelLed],
	["Channel 07", ChannelLed],
	["Channel 08", ChannelLed],
	["Channel 09", ChannelLed],
	["Channel 10", ChannelLed],
	["Channel 11", ChannelLed],
	["Channel 12", ChannelLed],
	["Channel 13", ChannelLed],
	["Channel 14", ChannelLed],
	["Channel 15", ChannelLed],
	["Channel 16", ChannelLed]
];

let ChannelIndex = [19,18,17,16,24,25,26,27,20,21,22,23,31,30,29,28];

function SetupChannels()
{
	device.SetLedLimit(DeviceMaxLedLimit);

	for(let i = 0; i < ChannelArray.length; i++)
	{
		device.addChannel(ChannelArray[i][0], ChannelArray[i][1]);
	}
}

export function Initialize() 
{
	SetupChannels();
	Save_Settings();
    device.setFrameRateTarget(60);
}

export function Render() 
{
	SendData = [];
 
	for(let i = 0; i < ChannelArray.length; i++)
	{ 
		SendChannel(i);
	}
	SendData.sort((a, b) => a[0] - b[0]);
  ch_led_num_callback();
	const Groups = [ChLedNum.slice(16, 32)];
	let chGroups = [];
	let finalResultLength = []; 
	for(let i = 0; i < Groups.length; i++)
	{
		const sum = Groups[i].reduce((total, currentValue) => total + currentValue, 0);
		if(sum != 0);
		{
			const finalResult = groupLeds(Groups[i], 340);
			chGroups.push(...finalResult);
			finalResultLength[i] = chGroups.length;
		}	
	}
	const result = getHeadTailIndices(chGroups);
	for(let i = 0; i < result.length; i++)
	{
		let Markers = 0;
		if(i == result.length-1)
		{
			Markers = 2;
		}	
		Send_data_V2(result[i][0],result[i][1],Markers) 	
	}	
}

function ch_led_num_callback()
{
	let ChLedNum_temp = new Array(32).fill(0);
	for (let i = 0; i < SendData.length; i++) 
	{
		ChLedNum_temp[SendData[i][0]] = (SendData[i].length -1)/3;
	}
	if(areArraysEqual(ChLedNum, ChLedNum_temp) == false)
	{
		ChLedNum = ChLedNum_temp.slice();
		let Ch_led_data = [];
		for(let i = 0;  i < ChLedNum.length; i++)
		{
			let { high, low } = splitHex(ChLedNum[i]);
			Ch_led_data[i * 2]    = high;
			Ch_led_data[i * 2 +1] = low;
		}	
		device.write([0,0x88, ...Ch_led_data], 1024);
		device.log("Update channel LED count: "+ ChLedNum);
	}		
}

function Send_data_V2(Ch_start,Ch_end,Markers) 
{
	let packet = [0x00,0x40,SendData[Ch_start][0],SendData[Ch_end][0],Markers];
	for(let index = Ch_start;index <= Ch_end;index++)
	{
		packet.push(...SendData[index].splice(1, SendData[index].length));		
	}
	device.write(packet,1024);
}

export function Shutdown() 
{
	Save_Settings();
	let packet = [0x00,0xff];
	device.write(packet, 513);
	device.pause(50);
}

function SendChannel(Channel, shutdown = false)
{
	// device.log(Channel);
	let ChannelLedCount = device.channel(ChannelArray[Channel][0]).ledCount > ChannelArray[Channel][1] ? ChannelArray[Channel][1] : device.channel(ChannelArray[Channel][0]).ledCount;
	let componentChannel = device.channel(ChannelArray[Channel][0]);

	let RGBData = [];

	if(shutdown)
	{
		RGBData = device.createColorArray(shutdownColor, ChannelLedCount, "Inline", "GRB");
	}
	else if(LightingMode === "Forced")
	{
		RGBData = device.createColorArray(forcedColor, ChannelLedCount, "Inline", "GRB");
	}
	else if(componentChannel.shouldPulseColors())
	{
		ChannelLedCount = ChannelLed;

		let pulseColor = device.getChannelPulseColor(ChannelArray[Channel][0], ChannelLedCount);
		RGBData = device.createColorArray(pulseColor, ChannelLedCount, "Inline", "GRB");
	}
	else
	{
		RGBData = device.channel(ChannelArray[Channel][0]).getColors("Inline", "GRB");
	}

	var NumPackets = Math.ceil(ChannelLedCount/ MaxLedsInPacket);


	for(var CurrPacket = 0; CurrPacket < NumPackets; CurrPacket++)
	{
		let packet = [ChannelIndex[Channel]];
		packet.push(...RGBData.splice(0, RGBData.length));
		SendData.push(packet);
		
	}	
}

function getHeadTailIndices(inputArray) 
{
  let currentIndex = 0;

  return inputArray.map((subArray) => 
  {
    const startIndex = currentIndex;
    const endIndex = currentIndex + subArray.length - 1;
    currentIndex = endIndex + 1;
    return [startIndex, endIndex];
  });
}

function groupLeds(inputArray, maxLedsPerGroup) 
{
    const result = [];
    let currentGroup = [];
    let currentGroupSum = 0;

    for (let ledCount of inputArray) 
    {
        if (ledCount !== 0) 
        {
            if (currentGroup.length === 0 || currentGroupSum + ledCount <= maxLedsPerGroup) 
            {
                currentGroup.push(ledCount);
                currentGroupSum += ledCount;
            } 
            else 
            {
                result.push([...currentGroup]);
                currentGroup = [ledCount];
                currentGroupSum = ledCount;
            }
        }
    }

    if (currentGroup.length > 0) 
    {
        result.push([...currentGroup]);
    }

    return result;
}

function Save_Settings() 
{
	let Mos = 0;
	let RGBData = [];
	let packet1 = [];
	RGBData = device.createColorArray(shutdownColor, 1, "Inline");	
	if(HLE === "Static")
	{
		packet1 = [0x00,0x80,Mos,0x03,RGBData[0],RGBData[1],RGBData[2]];
	}	
	if(HLE === "Nollie")
	{
		packet1 = [0x00,0x80,Mos,0x01,RGBData[0],RGBData[1],RGBData[2]];
	}	
	device.write(packet1, 513);
	device.pause(50);
}

function areArraysEqual(arr1, arr2) 
{
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

function hexToRgb(hex) 
{
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}

function splitHex(num) {
  const high = (num >>> 8) & 0xFF; // 取高 8 位，并且将低 24 位清零
  const low = num & 0xFF; // 取低 8 位
  // const chk = high ^ low ^ 0x55; // 计算校验值
  return { high, low }; // 返回高位、低位和校验值的整数
}

export function Validate(endpoint)
{
	return endpoint.interface === 0 ;
}

export function ImageUrl()
{
	return "https://gitee.com/cnn123666/nollie-controller/raw/master/Image/Nollie16V3.png";
}