export function Name() { return "Nollie"; } 
export function VendorId() { return 0x16D3; }
export function ProductId() { return 0x0001; }
export function Publisher() { return "Nollie"; } 
export function Size() { return [1, 1]; }
export function DefaultPosition(){return [0, 0];}
export function DefaultScale(){return 1.0;}
export function Type() { return "Hid"; }

export function ControllableParameters() 
{
	return [
		{"property":"shutdownColor", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"000000"},
		{"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced","Time"], "default":"Canvas"},
		{"property":"forcedColor", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"009bde"},
		{"property":"EF_Mode", "label":"Hardware Mode", "type":"combobox", "values":["Shutdown Color", "Time"], "default":"Time"}
	];
}

const DeviceMaxLedLimit = 256;
const MaxLedsInPacket = 21;
const Brightness = 50;
const OVER_TIME = 33 * 30 * 60
let time_count = 0;
let mode = 0;

let ChannelArray = 
[
	["Channel 01", 256]
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
	SetConfig();
}

export function Render() 
{
	for(let i = 0; i < ChannelArray.length; i++)
	{
		SendChannel(i);
	}
	time_count++;
	time_callback();
}

function time_callback() 
{
	if(time_count>OVER_TIME)
	{
		time_count = 0;
		SetConfig();
	}	
}

export function Shutdown() 
{
	SetConfig(true);
}

function SetConfig(shutdown = false)
{
	if(shutdown == false)
	{
		if(EF_Mode == "Canvas")
		{
			return;
		}	
	}	
	if(EF_Mode == "Shutdown Color")
	{
		mode = 0;
	}
	else if(EF_Mode == "Time")
	{
		mode = 1;
	}	
	let RGBData = [];
	RGBData = device.createColorArray(shutdownColor, 1, "Inline");	
	const unixTimestamp = Math.floor(Date.now() / 1000); 
	const byteArray = unixTimestampToByteArray(unixTimestamp);
	let packet = [0x00,0xfe,0x01,RGBData[0],RGBData[1],RGBData[2],Brightness,byteArray[0],byteArray[1],byteArray[2],byteArray[3],mode]
	device.write(packet, 65);
	device.pause(1);
	device.log("Update Time");
}
function SendChannel(Channel, shutdown = false) 
{

	if(LightingMode === "Time") 
	{
		return;
	}	
	let ChannelLedCount = device.channel(ChannelArray[Channel][0]).ledCount > ChannelArray[Channel][1] ? ChannelArray[Channel][1] : device.channel(ChannelArray[Channel][0]).ledCount;
	let componentChannel = device.channel(ChannelArray[Channel][0]); 

	
	let RGBData = [];

	if(shutdown)
	{

		RGBData = device.createColorArray(shutdownColor, ChannelLedCount, "Inline");
		
	}
	else if(LightingMode === "Forced") 
	{
		
		RGBData = device.createColorArray(forcedColor, ChannelLedCount, "Inline");
	}
	else if(componentChannel.shouldPulseColors()) 
	{
		ChannelLedCount = 256;
		
		let pulseColor = device.getChannelPulseColor(ChannelArray[Channel][0], ChannelLedCount);
		RGBData = device.createColorArray(pulseColor, ChannelLedCount, "Inline");
	}
	else
	{
		
		RGBData = device.channel(ChannelArray[Channel][0]).getColors("Inline");
		
		
	}

	let NumPackets = Math.ceil(ChannelLedCount / MaxLedsInPacket); 
 	
	for(let CurrPacket = 0; CurrPacket < NumPackets; CurrPacket++)
	{
		let packet = [0x00, CurrPacket+Channel*2];

		packet.push(...RGBData.splice(0, 63));

		device.write(packet, 65);
	}
}

function unixTimestampToByteArray(unixTimestamp) 
{
  const byteArray = new Uint8Array(4); 
  byteArray[0] = (unixTimestamp >> 24) & 0xFF;
  byteArray[1] = (unixTimestamp >> 16) & 0xFF;
  byteArray[2] = (unixTimestamp >> 8) & 0xFF;
  byteArray[3] = unixTimestamp & 0xFF;
  return byteArray;
}


export function Validate(endpoint)
{
	return endpoint.interface === 2;
}

export function Image()
{
	return "";
}