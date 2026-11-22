namespace Formulate.Core.Tests
{
    using System;
    using System.Collections.Generic;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// A logger that remembers what was logged.
    /// </summary>
    internal sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message, Exception Exception)> Entries { get; } = new List<(LogLevel, string, Exception)>();

        public IDisposable BeginScope<TState>(TState state) => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
            Func<TState, Exception, string> formatter)
        {
            Entries.Add((logLevel, formatter(state, exception), exception));
        }
    }
}
