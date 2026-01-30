console.log("000.007 >###> lib/r34lp0w3r.js >>>")

var _limpiApostrofes=function(txt){
	console.log("*** > limpiApostrofes("+txt+") ***");
	var apostrofes=[39,96,8216,8217];
	var ret="";
	for (var i=0; i < txt.length; i++) 
	{
		var chr=txt.charAt(i);
		if (apostrofes.indexOf(txt.charCodeAt(i))!=-1)
			ret=ret+"'";
		else
			ret=ret+txt.charAt(i);
	}
	console.log("*** limpiApostrofes("+ret+") < ***");
	return ret;
}


if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
            }
            return padString.slice(0,targetLength) + String(this);
        }
    };
}

console.log("000.007 >###> lib/r34lp0w3r.js <<<")