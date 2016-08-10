describe('waitStateChange event', function () {
    it('must be emitted twice', function () {
        expect(testrun.waitStateChange.calledTwice).be.ok();
    });

    it('must be emitted first saying that waiting state starts', function () {
        expect(testrun.waitStateChange.getCall(0).args[2]).be(true);
    });

    it('must send the time for possible next state change after start', function () {
        expect(testrun.waitStateChange.getCall(0).args[3]).be(200);
        expect(testrun.waitStateChange.getCall(0).args[4]).be(0);
    });

    it('must be emitted second time saying that waiting state ends', function () {
        expect(testrun.waitStateChange.getCall(1).args[2]).be(false);
    });

    it('must send the time for last state change after end', function () {
        expect(testrun.waitStateChange.getCall(1).args[3]).be(0);
        expect(testrun.waitStateChange.getCall(1).args[4]).be(200);
    });
});
