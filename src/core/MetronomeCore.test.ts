import { MetronomeCore } from "./MetronomeCore";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock Web Audio API
class MockAudioContext {
    private _currentTime = 0;
    get currentTime() {
        return this._currentTime;
    }
    state = "running";
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator = vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        frequency: {
            setValueAtTime: vi.fn(),
        }
    }));
    createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        }
    }));
    close = vi.fn();
    // Helper to advance time for testing
    advanceTime(seconds: number) {
        this._currentTime += seconds;
    }
}

vi.stubGlobal("AudioContext", MockAudioContext);

describe("MetronomeCore", () => {
    let metronome: MetronomeCore;

    beforeEach(() => {
        metronome = new MetronomeCore();
    });

    it("should initialize with default values", () => {
        expect(metronome.bpm).toBe(90);
        expect(metronome.meter).toBe(4);
        expect(metronome.isPlaying).toBe(false);
    });

    it("should set bpm within valid range", () => {
        metronome.bpm = 150;
        expect(metronome.bpm).toBe(150);

        metronome.bpm = 20;
        expect(metronome.bpm).toBe(30); // minBpm

        metronome.bpm = 400;
        expect(metronome.bpm).toBe(300); // maxBpm
    });

    it("should set meter and reset accents", () => {
        metronome.meter = 3;
        expect(metronome.meter).toBe(3);
        expect(metronome.accents).toEqual([true, false, false]);
    });

    it("should start and stop the metronome", async () => {
        await metronome.start();
        expect(metronome.isPlaying).toBe(true);

        metronome.stop();
        expect(metronome.isPlaying).toBe(false);
    });

    it("should initialize with custom config", () => {
        const customMetronome = new MetronomeCore({
            bpm: 120,
            meter: 3,
            accents: [true, true, false],
        });
        expect(customMetronome.bpm).toBe(120);
        expect(customMetronome.meter).toBe(3);
        expect(customMetronome.accents).toEqual([true, true, false]);
    });

    it("should increase and decrease BPM", () => {
        metronome.bpm = 100;
        metronome.increaseBpm(10);
        expect(metronome.bpm).toBe(110);

        metronome.decreaseBpm(20);
        expect(metronome.bpm).toBe(90);
    });

    it("should toggle play/pause", async () => {
        expect(metronome.isPlaying).toBe(false);
        
        await metronome.toggle();
        expect(metronome.isPlaying).toBe(true);

        metronome.toggle();
        expect(metronome.isPlaying).toBe(false);
    });

    it("should register onTick callback and allow unsubscription", () => {
        const tickCallback = vi.fn();
        const unsubscribe = metronome.onTick(tickCallback);
        
        expect(typeof unsubscribe).toBe("function");
        
        unsubscribe();
        // Verify callback can be unsubscribed (no error thrown)
        expect(true).toBe(true);
    });

    it("should call onStateChange callback when state changes", async () => {
        const stateChangeCallback = vi.fn();
        metronome.onStateChange(stateChangeCallback);

        metronome.bpm = 120;
        expect(stateChangeCallback).toHaveBeenCalled();
        expect(stateChangeCallback.mock.calls[0][0].bpm).toBe(120);
        expect(stateChangeCallback.mock.calls[0][0].isPlaying).toBe(false);
    });

    it("should allow unsubscribing from callbacks", () => {
        const tickCallback = vi.fn();
        const stateCallback = vi.fn();

        const unsubscribeTick = metronome.onTick(tickCallback);
        const unsubscribeState = metronome.onStateChange(stateCallback);

        unsubscribeTick();
        unsubscribeState();

        metronome.bpm = 150;
        // State callback should not be called after unsubscribe
        expect(stateCallback).not.toHaveBeenCalled();
    });

    it("should set and toggle accents", () => {
        metronome.setAccent(1, true);
        expect(metronome.accents[1]).toBe(true);

        metronome.toggleAccent(0);
        expect(metronome.accents[0]).toBe(false); // Was true, now false

        metronome.toggleAccent(0);
        expect(metronome.accents[0]).toBe(true); // Toggled back
    });

    it("should set meter with custom accents", () => {
        metronome.setMeter(5, [true, false, true, false, true]);
        expect(metronome.meter).toBe(5);
        expect(metronome.accents).toEqual([true, false, true, false, true]);
    });

    it("should reset pulse to 0 on stop", async () => {
        await metronome.start();
        // Pulse should be 0 initially, then advance when ticking
        metronome.stop();
        expect(metronome.pulse).toBe(0);
    });

    it("should dispose and cleanup resources", async () => {
        const stateCallback = vi.fn();
        metronome.onStateChange(stateCallback);
        
        await metronome.start();
        metronome.dispose();

        expect(metronome.isPlaying).toBe(false);
        // After dispose, callbacks should be cleared
        // Clear the mock to only check calls after dispose
        stateCallback.mockClear();
        metronome.bpm = 200;
        expect(stateCallback).not.toHaveBeenCalled();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });
});
