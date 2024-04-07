export function Name() { return "Nollie1"; } 
export function VendorId() { return 0x16D2; }
export function ProductId() { return 0x1F11; }
export function Publisher() { return "Nollie"; } 
export function Type() { return "Hid"; }
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
HLE:readonly
Mos_enable:readonly
*/
export function ControllableParameters() 
{
	return [
		{"property":"shutdownColor", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"000000"},
		{"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"009bde"},
		{"property":"HLE", "label":"Hardware effect", "type":"combobox", "values":["Static", "Nollie"], "default":"Static"},
		{"property":"Mos_enable","label":"Source of electricity supply", "type":"combobox", "values":["USB", "Externally"], "default":"USB"},
	];
}

export function onMos_enableChanged() 
{
	set_mos();
}

export function SubdeviceController() { return true; }

const ChannelLedNum =  630;
const ChannelNum =  1;
const DeviceMaxLedLimit = ChannelLedNum * ChannelNum;
const MaxLedsInPacket = 21;
const sampling_frequency = 150;
let voltage_count = 0;
let version = 0;
let ch_led_num = [];
let realtime_led_num = [];
let ChannelArray = 
[
	["Channel 1", ChannelLedNum]
];

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
	get_version();
	init_ch_led_num();
	set_hardware_effect();
    device.setFrameRateTarget(60);
}

function get_version()
{
	var packet = new Array(65).fill(0);
	packet[1] = 0xFC;
	packet[2] = 0x01;
	device.flush();
	device.write(packet, 65);
	var config = device.read(packet, 65);
	version = config[2];
	device.log("Version: "+ version);
}

function init_ch_led_num()
{
	var packet = new Array(65).fill(0);
	packet[1] = 0xFC;
	packet[2] = 0x03;
	device.flush();
	device.write(packet, 65);
	var config = device.read(packet, 65);
	for (var i = 0; i < ChannelNum; i++) 
	{
		ch_led_num[i] = config[(i*2)] * 256 + config[1+(i*2)]; 
	}
	device.log("Channel led count: "+ ch_led_num);
}

function ch_led_num_callback()
{
	if(areArraysEqual(ch_led_num, realtime_led_num) == false)
	{
		ch_led_num = realtime_led_num.slice();
		var packet = new Array(65).fill(0);
	  	packet[1] = 0xFE;
	  	packet[2] = 0x03;
	  	for (var i = 0; i < ch_led_num.length; i++) 
	  	{
		  	let { high, low } = splitHex(ch_led_num[i]);
		  	packet[3+(i*2)] = low;
		  	packet[4+(i*2)] = high;
	 	}
	  	device.write(packet, 65);
		device.log("Update channel LED count: "+ ch_led_num);
	}	
}

export function Render() 
{
	for(let i = 0; i < ChannelArray.length; i++)
	{
		let led_num = SendChannel(i);
		realtime_led_num[i] = led_num;
	}
	ch_led_num_callback();
}

export function Shutdown() 
{
	for(let i = 0; i < ChannelArray.length; i++)
	{
		SendChannel(i, true);
	}
	set_hardware_effect(true);
}

function SendChannel(Channel, shutdown = false) 
{
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
		ChannelLedCount = ChannelLedNum;
		
		let pulseColor = device.getChannelPulseColor(ChannelArray[Channel][0], ChannelLedCount);
		RGBData = device.createColorArray(pulseColor, ChannelLedCount, "Inline", "GRB");
	}
	else
	{
		RGBData = device.channel(ChannelArray[Channel][0]).getColors("Inline", "GRB");
	}

	let NumPackets = Math.ceil(ChannelLedCount / MaxLedsInPacket); 
 	
	for(let CurrPacket = 0; CurrPacket < NumPackets; CurrPacket++)
	{
		let packet = [0x00, CurrPacket+Channel*6];
		packet.push(...RGBData.splice(0, 63));
		device.write(packet, 65);
	}
	return ChannelLedCount;
}

function set_hardware_effect(shutdown = false)
{
	if(HLE === "Static")
	{
		let RGBData = [];
		RGBData = device.createColorArray(shutdownColor, 1, "Inline");	
		let packet = [0x00,0xfe,0x02,0x00,RGBData[0],RGBData[1],RGBData[2],0x64,0x0a,0x00,0x01];
		device.write(packet, 65);
		device.pause(1);
		device.log("set Static");
	}
	if(shutdown)
	{
		let packet = [0x00,0xfe,0x01,0x00];
		device.write(packet, 65);
	}	
}

function set_mos()
{
	let packet = []; 
	if(Mos_enable === "USB")
	{
		packet = [0x00,0xfe,0x1A,0x00];
	}	
	else
	{
		packet = [0x00,0xfe,0x1A,0x01];
	}	
	
	device.write(packet, 65);
	device.log("set mos");
}

function splitHex(num) 
{
  const high = (num >>> 8) & 0xFF; // 取高 8 位，并且将低 24 位清零
  const low = num & 0xFF; // 取低 8 位
  // const chk = high ^ low ^ 0x55; // 计算校验值
  return { high, low }; // 返回高位、低位和校验值的整数
}

function areArraysEqual(arr1, arr2) 
{
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

function buildUInt16(lowByte, highByte) 
{
    return (lowByte & 0xFF) | ((highByte & 0xFF) << 8);
}

export function Validate(endpoint)
{
	return endpoint.interface === 0;
}

export function ImageUrl()
{
	return "https://gitee.com/cnn123666/nollie-controller/raw/master/Image/NOLLIE-RGB-600.png";
}