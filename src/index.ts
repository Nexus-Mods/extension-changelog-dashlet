import { setChangelogs } from './actions';
import ChangelogDashlet from './ChangelogDashlet';
import sessionReducer from './reducers';
import { IGithubRelease } from './types';

import * as Promise from 'bluebird';
import * as https from 'https';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';
import * as url from 'url';
import { log, types, util } from 'vortex-api';

function updateReleases(store: Redux.Store<any>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const relUrl = url.parse('https://api.github.com/repos/Nexus-Mods/Vortex/releases');
    https.get({
      ..._.pick(relUrl, ['port', 'hostname', 'path']),
      headers: {
        'User-Agent': 'Vortex',
      },
    }, res => {
      res.setEncoding('utf-8');
      const callsRemaining = parseInt(res.headers['x-ratelimit-remaining'] as string, 10);
      if ((res.statusCode === 403) && (callsRemaining === 0)) {
        const resetDate = parseInt(res.headers['x-ratelimit-reset'] as string, 10) * 1000;
        log('info', 'GitHub rate limit exceeded',
            { reset_at: (new Date(resetDate)).toString() });
        return;
      } else {
        log('debug', 'remaining API calls', { count: callsRemaining });
      }
      let output = '';
      res
        .on('data', data => output += data)
        .on('end', () => {
          try {
            const parsed: IGithubRelease[] = JSON.parse(output);
            if (!Array.isArray(parsed)) {
              log('error', 'expected array of github releases', { got: parsed });
              return;
            }
            // dropping releases before 0.12.7 because they weren't public and didn't have
            // proper changelogs
            const current = parsed
              .filter(rel => semver.valid(rel.name) && semver.gte(rel.name, '0.12.7'))
              .sort((lhs, rhs) => semver.compare(lhs.name, rhs.name));
            
            const state: types.IState = store.getState();
            const persistentLogs = util.getSafe(state, ['persistent', 'changelogs', 'changelogs'], []);

            if (persistentLogs.length !== current.length) {
              const changeLogs = current.map(rel => ({
                version: rel.name,
                text: rel.body,
                prerelease: rel.prerelease,
              }));

              store.dispatch(setChangelogs(changeLogs));
            }

            resolve();
          } catch (err) {
            reject(err);
          }
        });
    })
    .on('error', err => {
      reject(err);
    })
    .end();
  });
}

function main(context: types.IExtensionContext) {
  context.registerDashlet('Changelog', 1, 3, 200, ChangelogDashlet,
    (state: types.IState) => true,
  () => ({}), { closable: true });

  // We store changelogs persistently, so even on a rare edge case
  //  where the user has exceeded his GitHub rate limit (shouldn't be possible)
  //  we still have data to display.
  context.registerReducer(['persistent', 'changelogs'], sessionReducer);

  context.once(() => {
    context.api.setStylesheet('changelog',
      path.join(__dirname, 'changelog.scss'));
    updateReleases(context.api.store)
      .catch(err => {
        log('warn', 'failed to retrieve list of releases', err.message);
      });
  });

  return true;
}

export default main;
