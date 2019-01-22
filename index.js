/*eslint-env node*/
'use strict';

const RSVP = require('rsvp');
const glob  = require('glob');
const DeployPluginBase = require('ember-cli-deploy-plugin');
const exec = require('child_process').exec;
const execSync = require ('child_process').execSync;

module.exports = {
  name: 'deployjs-angular-build',

  createDeployPlugin: function(options) {
    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        environment: 'prod',
        outputPath: 'dist',
        deployUrl: '',
        baseHref: '/',
        aot: false
      },

      build: function(/* context */) {
        var self       = this;
        var outputPath = this.readConfig('outputPath');
        var buildEnv   = this.readConfig('environment');
        var deployUrl  = this.readConfig('deployUrl');
        var baseHref   = this.readConfig('baseHref');
        var aot        = this.readConfig('aot');

        var regex = /Angular CLI: ([0-9])\./;
        var ngCliVersionBuffer = execSync('ng version').toString('utf-8') || '';
        var substring = ngCliVersionBuffer.match(regex);
        var ngCliVersion = substring[1] || 1;
        var environmentOption = ngCliVersion >= 6 ? '--configuration=' : '--environment ';

        if (ngCliVersion >= 6 && buildEnv === 'prod') {
          buildEnv = 'production';
        }

        this.log('building app to `' + outputPath + '` using buildEnv `' + buildEnv + '`...', { verbose: true });

        return new RSVP.Promise(function(resolve, reject) {
          exec('node --max_old_space_size=8000 ./node_modules/@angular/cli/bin/ng build ' + environmentOption + buildEnv + ' --output-path=' + outputPath + ' --output-hashing=all'
            + (deployUrl ? ' --deploy-url=' + deployUrl : '')
            + (baseHref ? ' --base-href=' + baseHref : '')
            + (aot ? ' --aot' : ''),
            {maxBuffer: 1024 * 1024 * 32},
            function(err, stdout, stderr)
          {
            if(err) {
              this.log(err, { color: 'red' });
              reject(err);
              return;
            }

            resolve(outputPath);
          }.bind(this));
        }.bind(this))
        .then(this._logSuccess.bind(this, outputPath))
        .then(function(files) {
          files = files || [];

          return {
            distDir: outputPath,
            distFiles: files
          };
        })
        .catch(function(error) {
          this.log('build failed', { color: 'red' });
          return RSVP.reject(error);
        }.bind(this));
      },
      _logSuccess: function(outputPath) {
        var self = this;
        var files = glob.sync('**/**/*', { nonull: false, nodir: true, cwd: outputPath });

        if (files && files.length) {
          files.forEach(function(path) {
            self.log('✔  ' + path, { verbose: true });
          });
        }
        self.log('build ok', { verbose: true });

        return RSVP.resolve(files);
      }
    });
    return new DeployPlugin();
  }
};
