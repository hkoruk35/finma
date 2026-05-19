const text = '[RKLB](/ai?ticker=RKLB) (Rocket Lab USA, Inc.)';
const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[a-zA-Z0-9.-]+\]\(\/ai\?[tT]icker=[a-zA-Z0-9.-]+\))/g;
console.log('parts:', text.split(regex));
