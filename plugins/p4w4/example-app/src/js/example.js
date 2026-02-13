import { P4w4Plugin } from '@sokinternet/p4w4';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    P4w4Plugin.echo({ value: inputValue })
}
