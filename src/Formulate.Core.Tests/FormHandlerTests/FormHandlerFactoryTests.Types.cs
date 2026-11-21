using System;
using System.Threading;
using System.Threading.Tasks;
using Formulate.Core.FormHandlers;
using Formulate.Core.Submissions.Requests;

namespace Formulate.Core.Tests.FormHandlerTests
{
    public partial class FormHandlerFactoryTests
    {
        private static class Constants
        {
            public const string MissingFormHandlerKindId = "6EB639979DA349198EB29ED35547F740";
            
            public const string TestFormHandlerKindId = "91FF00DAE0F444B2AEF85A948C5E6074";

            public const string TestAsyncFormHandlerKindId = "2E3ADACB99394555900F4AC4F9DAA6EE";
        }

        private class TestFormHandlerSettings : IFormHandlerSettings
        {
            public Guid KindId { get; set; }
            public Guid Id { get; set; }
            public string Name { get; set; }
            public string Alias { get; set; }
            public bool Enabled { get; set; }
            public string Data { get; set; }
        }

        private sealed class TestFormHandlerDefinition : FormHandlerDefinition
        {
            public override Guid KindId => Guid.Parse(Constants.TestFormHandlerKindId);
            
            public override string Name => "Test Form Handler";

            public override string Directive => throw new NotImplementedException();

            public override string Icon => throw new NotImplementedException();

            public override FormHandler CreateHandler(IFormHandlerSettings settings)
            {
                return new TestFormHandler(settings);
            }

            public override object GetBackOfficeConfiguration(IFormHandlerSettings settings)
            {
                return null;
            }
        }

        private sealed class TestFormHandler : FormHandler
        {
            public TestFormHandler(IFormHandlerSettings settings) : base(settings)
            {
            }

            public override void Handle(FormSubmissionRequest submission)
            {
            }
        }
    }
}
