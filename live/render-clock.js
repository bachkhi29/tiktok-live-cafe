let timer;
self.onmessage = ({ data }) => {
  clearInterval(timer);
  if (data.running) timer = setInterval(() => self.postMessage('tick'), 1000 / (data.fps || 30));
};
