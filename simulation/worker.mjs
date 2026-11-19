import {parentPort,workerData} from 'node:worker_threads';
import {loadModels} from './models.mjs';
import {createEngine} from './engine.mjs';
import {play} from './agents.mjs';
import {compact} from './metrics.mjs';
const {sources,config,geometry,profile,seeds,dt,maxSeconds}=workerData;
const results=[];
for(const seed of seeds){
  const engine=createEngine(loadModels(sources,config),{seed,dt,maxSeconds,geometry});
  results.push(compact(play(engine,profile)));
}
parentPort.postMessage(results);
