namespace Formulate.Core.Tests.UtilityTests
{
    using System;
    using System.Collections.Generic;
    using DataValues;
    using DataValues.List;
    using Microsoft.Extensions.Logging;
    using Moq;
    using Utilities.Internal;
    using Xunit;

    public class GetDataValuesItemsUtilityTests
    {
        private static readonly Guid FieldId = Guid.Parse("11111111111111111111111111111111");

        private static readonly Guid DataValuesId = Guid.Parse("22222222222222222222222222222222");

        [Fact]
        public void Deleted_data_values_give_no_items_and_log_a_warning()
        {
            var harness = new Harness();

            var items = harness.Utility.GetValues(DataValuesId, FieldId);

            Assert.Empty(items);
            var entry = Assert.Single(harness.Logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains(FieldId.ToString(), entry.Message);
            Assert.Contains(DataValuesId.ToString(), entry.Message);
            Assert.Contains("no longer exist", entry.Message);
        }

        [Fact]
        public void Data_values_of_an_unknown_kind_give_no_items_and_log_a_warning()
        {
            var harness = new Harness();
            harness.Repository.Setup(x => x.Get(DataValuesId)).Returns(new PersistedDataValues { Id = DataValuesId });

            var items = harness.Utility.GetValues(DataValuesId, FieldId);

            Assert.Empty(items);
            var entry = Assert.Single(harness.Logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains(FieldId.ToString(), entry.Message);
            Assert.Contains(DataValuesId.ToString(), entry.Message);
            Assert.Contains("unknown kind", entry.Message);
        }

        [Fact]
        public void A_field_with_no_data_values_chosen_logs_nothing()
        {
            var harness = new Harness();

            var items = harness.Utility.GetValues(Guid.Empty, FieldId);

            Assert.Empty(items);
            Assert.Empty(harness.Logger.Entries);
        }

        [Fact]
        public void Existing_data_values_give_their_items()
        {
            var harness = new Harness();
            var settings = new PersistedDataValues { Id = DataValuesId };
            var dataValues = Mock.Of<IDataValues>(x => x.Items == new[] { new KeyValuePair<string, string>("Red", "red") });
            harness.Repository.Setup(x => x.Get(DataValuesId)).Returns(settings);
            harness.Factory.Setup(x => x.Create(settings)).Returns(dataValues);

            var items = harness.Utility.GetValues(DataValuesId, FieldId);

            Assert.Equal(new[] { new KeyValuePair<string, string>("Red", "red") }, items);
            Assert.Empty(harness.Logger.Entries);
        }

        [Fact]
        public void Data_values_their_kind_cannot_read_give_no_items_instead_of_failing()
        {
            // A drop down that uses list data values whose file was broken on disk.
            var settings = new PersistedDataValues
            {
                Id = DataValuesId,
                Name = "Colors",
                KindId = Guid.Parse(ListDataValuesDefinition.Constants.KindId),
                Data = """{"items":["red","green"]}""",
            };
            var repository = new Mock<IDataValuesEntityRepository>();
            repository.Setup(x => x.Get(DataValuesId)).Returns(settings);
            var definitions = new DataValuesDefinitionCollection(() => new IDataValuesDefinition[] { new ListDataValuesDefinition(new JsonUtility(new NewtonsoftJsonSerializer())) });
            var factoryLogger = new CapturingLogger<DataValuesFactory>();
            var logger = new CapturingLogger();
            var utility = new GetDataValuesItemsUtility(new DataValuesFactory(definitions, factoryLogger), repository.Object, logger);

            var items = utility.GetValues(DataValuesId, FieldId);

            Assert.Empty(items);
            Assert.Contains("Colors", Assert.Single(factoryLogger.Entries).Message);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains(FieldId.ToString(), entry.Message);
            Assert.Contains(DataValuesId.ToString(), entry.Message);
        }

        private sealed class Harness
        {
            public Harness()
            {
                Utility = new GetDataValuesItemsUtility(Factory.Object, Repository.Object, Logger);
            }

            public Mock<IDataValuesFactory> Factory { get; } = new Mock<IDataValuesFactory>();

            public Mock<IDataValuesEntityRepository> Repository { get; } = new Mock<IDataValuesEntityRepository>();

            public CapturingLogger Logger { get; } = new CapturingLogger();

            public GetDataValuesItemsUtility Utility { get; }
        }

        private sealed class CapturingLogger : ILogger<GetDataValuesItemsUtility>
        {
            public List<(LogLevel Level, string Message)> Entries { get; } = new List<(LogLevel, string)>();

            public IDisposable BeginScope<TState>(TState state) => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
                Func<TState, Exception, string> formatter)
            {
                Entries.Add((logLevel, formatter(state, exception)));
            }
        }
    }
}
