var _ = require('lodash'),
    expect = require('expect.js'),
    runtime = require('../../index'),
    sdk = require('postman-collection');

/* global describe, it */
describe('Option', function () {
    describe('Abort On Error', function () {
        it('should be able to abort a run on HTTP errors', function (mochaDone) {
            var runner = new runtime.Runner(),
                rawCollection = {
                    "variables": [],
                    "info": {
                        "name": "test",
                        "_postman_id": "cd9e83b1-03dd-18ae-ff02-574414594a87",
                        "description": "",
                        "schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
                    },
                    "item": [
                        {
                            "name": "Request Methods",
                            "description": "HTTP has multiple request \"verbs\", such as `GET`, `PUT`, `POST`, `DELETE`,\n`PATCH`, `HEAD`, etc. \n\nAn HTTP Method (verb) defines how a request should be interpreted by a server. \nThe endpoints in this section demonstrate various HTTP Verbs. Postman supports \nall the HTTP Verbs, including some rarely used ones, such as `PROPFIND`, `UNLINK`, \netc.\n\nFor details about HTTP Verbs, refer to [RFC 2616](http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html#sec9)\n",
                            "item": [
                                {
                                    "name": "First Request",
                                    "event": [
                                        {
                                            "listen": "test",
                                            "script": {
                                                "type": "text/javascript",
                                                "exec": "tests[\"Body contains headers\"] = responseBody.has(\"headers\");\ntests[\"Body contains args\"] = responseBody.has(\"args\");\ntests[\"Body contains url\"] = responseBody.has(\"url\");\n\nvar data = JSON.parse(responseBody)\n\ntests[\"Args key contains argument passed as url parameter\"] = 'test' in data.args"
                                            }
                                        }
                                    ],
                                    "request": {
                                        "url": "https://postman-echo.com/get?test=123",
                                        "method": "GET",
                                    }
                                },
                                {
                                    "name": "Second Request",
                                    "event": [
                                        {
                                            "listen": "prerequest",
                                            "script": {
                                                "type": "text/javascript",
                                                "exec": "if (iteration === 1) { throw new Error('omg!'); }"
                                            }
                                        },
                                        {
                                            "listen": "test",
                                            "script": {
                                                "type": "text/javascript",
                                                "exec": ";"
                                            }
                                        }
                                    ],
                                    "request": {
                                        "url": "https://somenonexistantdomain/get?test=123",
                                        "method": "GET"
                                    }
                                },
                                {
                                    "name": "Third Request",
                                    "event": [
                                        {
                                            "listen": "test",
                                            "script": {
                                                "type": "text/javascript",
                                                "exec": ";"
                                            }
                                        }
                                    ],
                                    "request": {
                                        "url": "https://postman-echo.com/get?test=123",
                                        "method": "GET"
                                    }
                                }
                            ]
                        }
                    ]
                },
                collection = new sdk.Collection(rawCollection),
                testables = {
                    iterationsStarted: [],
                    iterationsComplete: [],
                    itemsStarted: {},
                    itemsComplete: {}
                },  // populate during the run, and then perform tests on it, at the end.

                /**
                 * Since each callback runs in a separate callstack, this helper function
                 * ensures that any errors are forwarded to mocha
                 *
                 * @param func
                 */
                check = function (func) {
                    try { func(); }
                    catch (e) { mochaDone(e); }
                };

            runner.run(collection, {
                iterationCount: 2,
                abortOnError: true
            }, function (err, run) {
                var runStore = {};  // Used for validations *during* the run. Cursor increments, etc.

                expect(err).to.be(null);
                run.start({
                    start: function (err, cursor) {
                        check(function () {
                            expect(err).to.be(null);
                            expect(cursor).to.have.property('position', 0);
                            expect(cursor).to.have.property('iteration', 0);
                            expect(cursor).to.have.property('length', 3);
                            expect(cursor).to.have.property('cycles', 2);
                            expect(cursor).to.have.property('eof', false);
                            expect(cursor).to.have.property('empty', false);
                            expect(cursor).to.have.property('bof', true);
                            expect(cursor).to.have.property('cr', false);
                            expect(cursor).to.have.property('ref');

                            // Set this to true, and verify at the end, so that the test will fail even if this
                            // callback is never called.
                            testables.started = true;
                        });
                    },
                    beforeIteration: function (err, cursor){
                        check(function () {
                            expect(err).to.be(null);

                            testables.iterationsStarted.push(cursor.iteration);
                            runStore.iteration = cursor.iteration;
                        });
                    },
                    iteration: function (err, cursor) {
                        check(function () {
                            expect(err).to.be(null);
                            expect(cursor.iteration).to.eql(runStore.iteration);

                            testables.iterationsComplete.push(cursor.iteration);
                        });
                    },
                    beforeItem: function (err, cursor, item) {
                        check(function () {
                            expect(err).to.be(null);

                            testables.itemsStarted[cursor.iteration] = testables.itemsStarted[cursor.iteration] || [];
                            testables.itemsStarted[cursor.iteration].push(item);
                            runStore.position = cursor.position;
                            runStore.ref = cursor.ref;
                        });
                    },
                    item: function (err, cursor, item) {
                        check(function () {
                            expect(err).to.be(null);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            testables.itemsComplete[cursor.iteration] = testables.itemsComplete[cursor.iteration] || [];
                            testables.itemsComplete[cursor.iteration].push(item);
                        });
                    },
                    beforePrerequest: function (err, cursor, events, item) {
                        check(function () {
                            expect(err).to.be(null);

                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            if (item.name === 'Second Request') {
                                expect(events.length).to.be(1);
                            }
                            else {
                                expect(events.length).to.be(0);
                            }
                        });
                    },
                    prerequest: function (err, cursor, results, item) {
                        check(function () {
                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            // The second request throws in the second iteration.
                            if (cursor.iteration === 1 && item.name === 'Second Request') {
                                expect(results[0].error).to.be.ok();
                                expect(results[0].error.message).to.be('omg!');
                                return;
                            }
                            expect(err).to.be(null);
                        });
                    },
                    beforeTest: function (err, cursor, events, item) {
                        check(function () {
                            expect(err).to.be(null);

                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            // This collection has no pre-request scripts
                            expect(events.length).to.be(1);
                        });
                    },
                    test: function (err, cursor, results, item) {
                        check(function () {
                            expect(err).to.be(null);

                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            var result = results[0];
                            expect(result.error).to.be(undefined);

                            var scriptResult = results[0];
                            expect(scriptResult.result.masked.scriptType).to.eql('test');
                        });
                    },
                    beforeRequest: function (err, cursor, request, item) {
                        check(function () {
                            expect(err).to.be(null);

                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);
                        });
                    },
                    request: function (err, cursor, response, request, item) {
                        check(function () {
                            // The second request contains a non existent host name.
                            if (item.name === 'Second Request') {
                                expect(err).to.be.ok();
                                expect(err.message).to.be('getaddrinfo ENOTFOUND ' +
                                    'somenonexistantdomain somenonexistantdomain:443')
                            }
                            else {
                                expect(err).to.be(null);
                                expect(response.code).to.be(200);
                            }

                            expect(request.url.toString()).to.be.ok();

                            // Sanity
                            expect(cursor.iteration).to.eql(runStore.iteration);
                            expect(cursor.position).to.eql(runStore.position);
                            expect(cursor.ref).to.eql(runStore.ref);

                            expect(request).to.be.ok();
                        });
                    },
                    done: function (error) {
                        // Should Error
                        expect(error).to.be.ok();
                        expect(error.message).to.be('getaddrinfo ENOTFOUND ' +
                            'somenonexistantdomain somenonexistantdomain:443');

                        expect(testables.started).to.be(true);

                        // Ensure that we started one iteration (and completed none)
                        expect(testables.iterationsStarted).to.eql([0]);
                        expect(testables.iterationsComplete).to.eql([]);

                        expect(testables.itemsStarted[0].length).to.be(2);
                        expect(testables.itemsComplete[0].length).to.be(1);
                        expect(_.map(testables.itemsStarted[0], 'name')).to.eql([
                            'First Request', 'Second Request'
                        ]);
                        expect(_.map(testables.itemsComplete[0], 'name')).to.eql([
                            'First Request'
                        ]);

                        // Expect the end position to be correct
                        expect(runStore.iteration).to.be(0);
                        expect(runStore.position).to.be(1);

                        mochaDone();
                    }
                });
            });
        });
    });
});
