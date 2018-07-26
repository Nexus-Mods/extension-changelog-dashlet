import ChangelogDashlet from './ChangelogDashlet';
import sessionReducer from './reducers';
import { IGithubRelease } from './types';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as https from 'https';
import * as _ from 'lodash';
import * as path from 'path';
import * as semver from 'semver';
import * as url from 'url';
import { log, types } from 'vortex-api';
import { setChangelogs } from './actions';

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
      let output = '';
      res
        .on('data', data => output += data)
        .on('end', () => {
          const appVersion = remote.app.getVersion();
          const parsed: IGithubRelease[] = JSON.parse(output);
          const current = parsed
            .filter(rel =>
              semver.valid(rel.name) && semver.gte(rel.name, appVersion))
            .sort((lhs, rhs) => semver.compare(lhs.name, rhs.name));
          store.dispatch(setChangelogs(
            current.map(rel => ({
              version: rel.name,
              text: rel.body,
              prerelease: rel.prerelease,
             }))));
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

  context.registerReducer(['session', 'changelogs'], sessionReducer);

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
