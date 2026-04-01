import mitt from 'mitt';
type Events = {
  'add-analysis-layer': any;
};
const emitter = mitt<Events>();
export default emitter;