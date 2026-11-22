using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// A logger provider that remembers everything logged through it.
/// </summary>
internal sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<LogEntry> _entries = new();

    public IReadOnlyList<LogEntry> Entries => _entries.ToArray();

    public IEnumerable<LogEntry> Errors => Entries.Where(x => x.Level == LogLevel.Error);

    public IEnumerable<LogEntry> Warnings => Entries.Where(x => x.Level == LogLevel.Warning);

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(this, categoryName);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(CapturingLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            provider._entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception), exception));
        }
    }
}

internal sealed record LogEntry(string Category, LogLevel Level, string Message, Exception? Exception);
